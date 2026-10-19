//! Local decisions with GLiNER2.5-Decide, powered by Hugging Face Candle.
//!
//! A decision model reads a text and a list of labels, and returns the label that matches the text with a
//! probability. It writes no text. After the first download of the model files, the text never leaves the computer.

use anyhow::{bail, Context, Result};
use candle_core::{DType, Device};
use candle_nn::VarBuilder;
use candle_transformers::models::debertav2::Config as EncoderConfig;
use clap::ValueEnum;
use hf_hub::{HFClientSync, HFError, HFRepositorySync, RepoTypeModel};
use serde::Deserialize;
use serde_json::Value;
use std::path::PathBuf;
use tokenizers::Tokenizer;

pub mod model;
pub mod prompt;
pub mod task;
pub mod words;

pub use task::{
    DecisionLabel, DecisionTask, LabelScore, TaskDecision, DEFAULT_MULTI_LABEL_THRESHOLD,
};

use model::DecisionNetwork;
use prompt::build_prompt;

/// The model that the engine loads when the caller names none.
pub const DEFAULT_MODEL_ID: &str = "fastino/GLiNER2.5-Decide";

/// A local inference backend.
#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub enum Backend {
    /// The processor of the computer.
    Cpu,
    /// An NVIDIA graphics card. It needs a build with the feature `cuda`.
    Cuda,
    /// The graphics chip of an Apple computer. It needs a build with the feature `metal`.
    Metal,
}

impl Backend {
    /// The command line spelling of this backend.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Cpu => "cpu",
            Self::Cuda => "cuda",
            Self::Metal => "metal",
        }
    }

    fn device(self) -> Result<Device> {
        match self {
            Self::Cpu => Ok(Device::Cpu),
            Self::Cuda => {
                #[cfg(feature = "cuda")]
                {
                    Ok(Device::new_cuda(0).context("Could not start CUDA device 0")?)
                }
                #[cfg(not(feature = "cuda"))]
                {
                    bail!("CUDA is unavailable in this build; rebuild with `--features cuda` and use a compatible NVIDIA GPU")
                }
            }
            Self::Metal => {
                #[cfg(feature = "metal")]
                {
                    Ok(Device::new_metal(0).context("Could not start Metal device 0")?)
                }
                #[cfg(not(feature = "metal"))]
                {
                    bail!("Metal is unavailable in this build; rebuild with `--features metal` on a supported Apple device")
                }
            }
        }
    }
}

/// Settings used to load a model and select its local backend.
#[derive(Clone, Debug)]
pub struct DecisionConfig {
    /// Hugging Face model repository identifier.
    pub model_id: String,
    /// Local inference backend.
    pub backend: Backend,
    /// Check Hugging Face for newer model files instead of immediately using cached files.
    pub check_model_updates: bool,
}

impl Default for DecisionConfig {
    fn default() -> Self {
        Self {
            model_id: DEFAULT_MODEL_ID.to_string(),
            backend: Backend::Cpu,
            check_model_updates: false,
        }
    }
}

/// The top level of the file `config.json` of a GLiNER2 model.
#[derive(Debug, Deserialize)]
struct ModelConfig {
    model_type: String,
    architecture: Option<String>,
    token_pooling: Option<String>,
    encoder_config: Value,
}

/// A loaded model ready to take decisions locally.
pub struct DecisionEngine {
    model_id: String,
    backend: Backend,
    network: DecisionNetwork,
    tokenizer: Tokenizer,
}

impl DecisionEngine {
    /// Downloads or reads cached model files and loads a supported GLiNER2 decision model.
    pub fn load(config: DecisionConfig) -> Result<Self> {
        let device = config.backend.device()?;
        let client =
            HFClientSync::new().context("Could not initialize the Hugging Face model cache")?;
        let repository = model_repository(&client, &config.model_id)?;

        let config_path = download(&repository, "config.json", config.check_model_updates)?;
        let tokenizer_path = download(&repository, "tokenizer.json", config.check_model_updates)?;
        let weights_path = download(&repository, "model.safetensors", config.check_model_updates)?;

        let model_config: ModelConfig = serde_json::from_slice(
            &std::fs::read(&config_path).context("Could not read the model configuration")?,
        )
        .context("The model configuration is not a GLiNER2 configuration")?;
        let encoder_config = read_encoder_config(model_config)?;

        let mut tokenizer = Tokenizer::from_file(&tokenizer_path)
            .map_err(anyhow::Error::msg)
            .context("Could not read the model tokenizer")?;
        tokenizer
            .with_truncation(None)
            .map_err(anyhow::Error::msg)
            .context("Could not configure the model tokenizer")?;
        tokenizer.with_padding(None);

        // Safety: the cached safetensors file is treated as immutable while Candle reads its memory map.
        let variables = unsafe {
            VarBuilder::from_mmaped_safetensors(&[weights_path], DType::F32, &device)
                .context("Could not load model weights")?
        };
        let network = DecisionNetwork::load(variables, &encoder_config)?;

        Ok(Self {
            model_id: config.model_id,
            backend: config.backend,
            network,
            tokenizer,
        })
    }

    /// The Hugging Face identifier of the loaded model.
    pub fn model_id(&self) -> &str {
        &self.model_id
    }

    /// The backend that runs the model.
    pub fn backend(&self) -> Backend {
        self.backend
    }

    /// Takes every decision in `tasks` about `text` with one pass of the model, and returns the decisions in the
    /// order of the tasks.
    pub fn decide(&self, text: &str, tasks: &[DecisionTask]) -> Result<Vec<TaskDecision>> {
        if tasks.is_empty() {
            bail!("At least one decision task is needed");
        }
        for task in tasks {
            task.validate()?;
        }
        let encoded = build_prompt(&self.tokenizer, text, tasks)?;
        let logits = self
            .network
            .label_logits(&encoded.input_ids, &encoded.label_positions)?;
        tasks
            .iter()
            .zip(logits.iter())
            .map(|(task, task_logits)| TaskDecision::from_logits(task, task_logits))
            .collect()
    }

    /// Returns the input of the model for `text` and `tasks`. It is useful to compare the tokens with another
    /// implementation.
    pub fn encode(&self, text: &str, tasks: &[DecisionTask]) -> Result<prompt::EncodedPrompt> {
        build_prompt(&self.tokenizer, text, tasks)
    }
}

fn read_encoder_config(model_config: ModelConfig) -> Result<EncoderConfig> {
    if model_config.model_type != "gliner2" {
        bail!(
            "The model type is `{}`; this package loads GLiNER2 models only",
            model_config.model_type
        );
    }
    let architecture = model_config.architecture.as_deref().unwrap_or("span");
    if architecture != "span" {
        bail!(
            "The model architecture is `{architecture}`; this package loads the `span` architecture only, which the \
             English model fastino/GLiNER2.5-Decide uses"
        );
    }
    let token_pooling = model_config.token_pooling.as_deref().unwrap_or("first");
    if token_pooling != "first" {
        bail!("The token pooling is `{token_pooling}`; this package supports `first` only");
    }
    let encoder_type = model_config
        .encoder_config
        .get("model_type")
        .and_then(Value::as_str)
        .unwrap_or("missing");
    if encoder_type != "deberta-v2" {
        bail!("The encoder type is `{encoder_type}`; this package supports `deberta-v2` only");
    }
    serde_json::from_value(model_config.encoder_config)
        .context("The model has a DeBERTa v2 configuration that Candle cannot read")
}

fn model_repository(
    client: &HFClientSync,
    model_id: &str,
) -> Result<HFRepositorySync<RepoTypeModel>> {
    let Some((owner, name)) = model_id.split_once('/') else {
        bail!("Model identifier must have the form `owner/model-name`")
    };
    if owner.is_empty() || name.is_empty() || name.contains('/') {
        bail!("Model identifier must have the form `owner/model-name`")
    }
    Ok(client.model(owner.to_string(), name.to_string()))
}

fn download(
    repository: &HFRepositorySync<RepoTypeModel>,
    filename: &str,
    check_model_updates: bool,
) -> Result<PathBuf> {
    if !check_model_updates {
        match repository
            .download_file()
            .filename(filename.to_string())
            .revision("main".to_string())
            .local_files_only(true)
            .send()
        {
            Ok(path) => return Ok(path),
            Err(HFError::LocalEntryNotFound { .. }) => {}
            Err(error) => {
                return Err(error)
                    .with_context(|| format!("Could not read cached model file `{filename}`"));
            }
        }
    }

    repository
        .download_file()
        .filename(filename.to_string())
        .revision("main".to_string())
        .send()
        .with_context(|| format!("Could not download `{filename}` from the selected model"))
}

#[cfg(test)]
mod tests {
    use super::{read_encoder_config, ModelConfig};
    use serde_json::json;

    fn model_config(value: serde_json::Value) -> ModelConfig {
        serde_json::from_value(value).expect("a model configuration")
    }

    fn deberta_config() -> serde_json::Value {
        json!({
            "model_type": "deberta-v2",
            "vocab_size": 128011,
            "hidden_size": 1024,
            "num_hidden_layers": 24,
            "num_attention_heads": 16,
            "intermediate_size": 4096,
            "hidden_act": "gelu",
            "hidden_dropout_prob": 0.1,
            "attention_probs_dropout_prob": 0.1,
            "max_position_embeddings": 512,
            "type_vocab_size": 0,
            "initializer_range": 0.02,
            "layer_norm_eps": 1e-7,
            "relative_attention": true,
            "max_relative_positions": -1,
            "position_biased_input": false,
            "pos_att_type": ["p2c", "c2p"],
            "position_buckets": 256,
            "share_att_key": true,
            "norm_rel_ebd": "layer_norm"
        })
    }

    #[test]
    fn reads_the_configuration_of_the_english_decision_model() {
        let config = read_encoder_config(model_config(json!({
            "model_type": "gliner2",
            "architecture": "span",
            "token_pooling": "first",
            "encoder_config": deberta_config()
        })))
        .unwrap();
        assert_eq!(config.hidden_size, 1024);
        assert_eq!(config.num_hidden_layers, 24);
    }

    #[test]
    fn rejects_the_boundary_architecture_of_the_multilingual_decision_model() {
        let error = read_encoder_config(model_config(json!({
            "model_type": "gliner2",
            "architecture": "boundary",
            "token_pooling": "first",
            "encoder_config": deberta_config()
        })))
        .unwrap_err();
        assert!(error.to_string().contains("`boundary`"), "{error}");
    }

    #[test]
    fn rejects_an_encoder_that_is_not_deberta_v2() {
        let error = read_encoder_config(model_config(json!({
            "model_type": "gliner2",
            "architecture": "span",
            "encoder_config": { "model_type": "modernbert", "hidden_size": 1792 }
        })))
        .unwrap_err();
        assert!(error.to_string().contains("`modernbert`"), "{error}");
    }

    #[test]
    fn rejects_a_model_that_is_not_gliner2() {
        let error = read_encoder_config(model_config(json!({
            "model_type": "bert",
            "encoder_config": deberta_config()
        })))
        .unwrap_err();
        assert!(error.to_string().contains("`bert`"), "{error}");
    }

    #[test]
    fn rejects_a_token_pooling_other_than_first() {
        let error = read_encoder_config(model_config(json!({
            "model_type": "gliner2",
            "token_pooling": "mean",
            "encoder_config": deberta_config()
        })))
        .unwrap_err();
        assert!(error.to_string().contains("`mean`"), "{error}");
    }
}
