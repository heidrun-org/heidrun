//! Local text embeddings powered by Hugging Face Candle.

use anyhow::{bail, Context, Result};
use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config as BertConfig};
use clap::ValueEnum;
use hf_hub::{HFClientSync, HFError, HFRepositorySync, RepoTypeModel};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tokenizers::{PaddingParams, PaddingStrategy, Tokenizer};

pub mod chunking;
pub use chunking::{chunk_document, chunk_document_with_overlap, ChunkingMode, TextChunk};

pub const DEFAULT_MODEL_ID: &str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";

/// A local inference backend.
#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub enum Backend {
    Cpu,
    Cuda,
    Metal,
    Wasm,
}

impl Backend {
    /// The command line spelling of this backend.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Cpu => "cpu",
            Self::Cuda => "cuda",
            Self::Metal => "metal",
            Self::Wasm => "wasm",
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
			Self::Wasm => bail!("WebAssembly (WASM) requires a separate browser build and is not available in the native command line tool"),
		}
    }
}

/// Settings used to load a model and select its local backend.
#[derive(Clone, Debug)]
pub struct EmbeddingConfig {
    /// Hugging Face model repository identifier.
    pub model_id: String,
    /// Local inference backend.
    pub backend: Backend,
    /// Check Hugging Face for newer model files instead of immediately using cached files.
    pub check_model_updates: bool,
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            model_id: DEFAULT_MODEL_ID.to_string(),
            backend: Backend::Cpu,
            check_model_updates: false,
        }
    }
}

/// A text and its normalized embedding vector.
#[derive(Clone, Debug, Serialize)]
pub struct TextEmbedding {
    /// The original input text.
    pub text: String,
    /// The normalized sentence embedding.
    pub vector: Vec<f32>,
}

/// A source chunk and its normalized vector.
#[derive(Clone, Debug, Serialize)]
pub struct ChunkEmbedding {
    #[serde(flatten)]
    pub chunk: TextChunk,
    pub vector: Vec<f32>,
}

/// Chunk vectors and an approximate normalized vector for the whole document.
#[derive(Clone, Debug, Serialize)]
pub struct DocumentEmbedding {
    pub global_vector: Vec<f32>,
    pub chunks: Vec<ChunkEmbedding>,
}

/// Time spent in each stage of loading a model.
#[derive(Clone, Debug, Default)]
pub struct ModelLoadTimings {
    pub device_initialization: Duration,
    pub repository_setup: Duration,
    pub config_file_lookup: Duration,
    pub tokenizer_file_lookup: Duration,
    pub weights_file_lookup: Duration,
    pub pooling_file_lookup: Duration,
    pub sentence_config_file_lookup: Duration,
    pub config_parsing: Duration,
    pub tokenizer_setup: Duration,
    pub weights_mapping: Duration,
    pub model_setup: Duration,
}

/// A loaded model ready to compute local embeddings.
pub struct EmbeddingEngine {
    model_id: String,
    backend: Backend,
    model: BertModel,
    tokenizer: Tokenizer,
    device: Device,
    max_tokens: usize,
    dimensions: usize,
}

impl EmbeddingEngine {
    /// Downloads or reads cached model files and loads a supported BERT sentence embedding model.
    pub fn load(config: EmbeddingConfig) -> Result<Self> {
        Self::load_with_timings(config).map(|(engine, _)| engine)
    }

    /// Loads a model and returns the time spent in each loading stage.
    pub fn load_with_timings(config: EmbeddingConfig) -> Result<(Self, ModelLoadTimings)> {
        let mut timings = ModelLoadTimings::default();
        let started = Instant::now();
        let device = config.backend.device()?;
        timings.device_initialization = started.elapsed();

        let started = Instant::now();
        let client =
            HFClientSync::new().context("Could not initialize the Hugging Face model cache")?;
        let repository = model_repository(&client, &config.model_id)?;
        timings.repository_setup = started.elapsed();

        let started = Instant::now();
        let config_path = download(&repository, "config.json", config.check_model_updates)?;
        timings.config_file_lookup = started.elapsed();

        let started = Instant::now();
        let tokenizer_path = download(&repository, "tokenizer.json", config.check_model_updates)?;
        timings.tokenizer_file_lookup = started.elapsed();

        let started = Instant::now();
        let weights_path = download(&repository, "model.safetensors", config.check_model_updates)?;
        timings.weights_file_lookup = started.elapsed();

        let started = Instant::now();
        // Sentence Transformers model repositories include this file, but it is
        // not always copied into a local cache by tools that only download the
        // model weights. Mean pooling is the supported fallback for BERT models.
        let pooling_path = download(
            &repository,
            "1_Pooling/config.json",
            config.check_model_updates,
        )
        .ok();
        timings.pooling_file_lookup = started.elapsed();

        let started = Instant::now();
        let sentence_config_path = download(
            &repository,
            "sentence_bert_config.json",
            config.check_model_updates,
        )
        .ok();
        timings.sentence_config_file_lookup = started.elapsed();

        let started = Instant::now();
        let model_config_json: Value = serde_json::from_slice(
            &std::fs::read(&config_path).context("Could not read the model configuration")?,
        )?;
        validate_bert_architecture(&model_config_json)?;
        if let Some(pooling_path) = pooling_path {
            validate_mean_pooling(&pooling_path)?;
        }
        let model_config: BertConfig = serde_json::from_value(model_config_json)
            .context("The model has a BERT configuration that Candle cannot read")?;
        let preferred_limit = if let Some(path) = sentence_config_path {
            let settings: Value = serde_json::from_slice(&std::fs::read(path)?)?;
            settings
                .get("max_seq_length")
                .and_then(Value::as_u64)
                .map(usize::try_from)
                .transpose()?
        } else if config.model_id == DEFAULT_MODEL_ID {
            Some(128)
        } else {
            None
        };
        let max_tokens = preferred_limit
            .unwrap_or(model_config.max_position_embeddings)
            .min(model_config.max_position_embeddings);
        if max_tokens < 3 {
            bail!("The model token limit must leave room for text and special tokens")
        }
        timings.config_parsing = started.elapsed();

        let started = Instant::now();
        let mut tokenizer = Tokenizer::from_file(&tokenizer_path)
            .map_err(anyhow::Error::msg)
            .context("Could not read the model tokenizer")?;
        tokenizer
            .with_truncation(None)
            .map_err(anyhow::Error::msg)
            .context("Could not configure the model tokenizer")?;
        tokenizer.with_padding(Some(PaddingParams {
            strategy: PaddingStrategy::BatchLongest,
            ..Default::default()
        }));
        timings.tokenizer_setup = started.elapsed();

        // Safety: the cached safetensors file is treated as immutable while Candle reads its memory map.
        let started = Instant::now();
        let variables = unsafe {
            VarBuilder::from_mmaped_safetensors(&[weights_path], DType::F32, &device)
                .context("Could not load model weights")?
        };
        timings.weights_mapping = started.elapsed();

        let started = Instant::now();
        let model = BertModel::load(variables, &model_config)
            .context("Could not load the BERT model weights into Candle")?;
        timings.model_setup = started.elapsed();

        Ok((
            Self {
                model_id: config.model_id,
                backend: config.backend,
                model,
                tokenizer,
                device,
                max_tokens,
                dimensions: model_config.hidden_size,
            },
            timings,
        ))
    }

    /// The configured model identifier.
    pub fn model_id(&self) -> &str {
        &self.model_id
    }

    /// The selected local backend.
    pub fn backend(&self) -> Backend {
        self.backend
    }

    /// Computes vectors for short inputs; rejects oversized inputs instead of truncating them.
    pub fn embed(&mut self, texts: &[String]) -> Result<Vec<TextEmbedding>> {
        if texts.is_empty() {
            bail!("Provide at least one text to embed")
        }
        if texts.iter().any(|text| text.trim().is_empty()) {
            bail!("Input text cannot be empty")
        }

        let encodings = self
            .tokenizer
            .encode_batch(texts.to_vec(), true)
            .map_err(anyhow::Error::msg)
            .context("Could not tokenize the input text")?;
        if encodings
            .iter()
            .any(|encoding| encoding.len() > self.max_tokens)
        {
            bail!("Input exceeds the model limit of {} tokens; use embed_document to split longer text", self.max_tokens)
        }
        let token_ids = encodings
            .iter()
            .map(|encoding| Tensor::new(encoding.get_ids(), &self.device))
            .collect::<candle_core::Result<Vec<_>>>()?;
        let masks = encodings
            .iter()
            .map(|encoding| Tensor::new(encoding.get_attention_mask(), &self.device))
            .collect::<candle_core::Result<Vec<_>>>()?;
        let token_ids = Tensor::stack(&token_ids, 0)?;
        let attention_mask = Tensor::stack(&masks, 0)?;
        let token_type_ids = token_ids.zeros_like()?;
        let token_embeddings =
            self.model
                .forward(&token_ids, &token_type_ids, Some(&attention_mask))?;
        let mask_for_pooling = attention_mask.to_dtype(DType::F32)?.unsqueeze(2)?;
        let mask_sum = mask_for_pooling.sum(1)?;
        let pooled = token_embeddings
            .broadcast_mul(&mask_for_pooling)?
            .sum(1)?
            .broadcast_div(&mask_sum)?;
        let normalized = normalize_l2(&pooled)?;
        let vectors = normalized.to_vec2::<f32>()?;

        Ok(texts
            .iter()
            .cloned()
            .zip(vectors)
            .map(|(text, vector)| TextEmbedding { text, vector })
            .collect())
    }

    /// Splits a whole document, embeds every chunk, and averages the chunk vectors.
    pub fn embed_document(
        &mut self,
        text: &str,
        mode: ChunkingMode,
        overlap_tokens: usize,
    ) -> Result<DocumentEmbedding> {
        let chunks = chunk_document_with_overlap(
            text,
            &self.tokenizer,
            self.max_tokens,
            mode,
            overlap_tokens,
        )?;
        let mut embedded = Vec::with_capacity(chunks.len());
        for batch in chunks.chunks(8) {
            let texts = batch
                .iter()
                .map(|chunk| chunk.text.clone())
                .collect::<Vec<_>>();
            let vectors = self.embed(&texts)?;
            embedded.extend(
                batch
                    .iter()
                    .cloned()
                    .zip(vectors)
                    .map(|(chunk, embedding)| ChunkEmbedding {
                        chunk,
                        vector: embedding.vector,
                    }),
            );
        }
        let mut average = vec![0_f64; self.dimensions];
        for chunk in &embedded {
            let weight = chunk.chunk.token_count.saturating_sub(2).max(1) as f64;
            for (sum, value) in average.iter_mut().zip(&chunk.vector) {
                *sum += f64::from(*value) * weight;
            }
        }
        let norm = average
            .iter()
            .map(|value| value * value)
            .sum::<f64>()
            .sqrt();
        if !norm.is_finite() || norm == 0.0 {
            bail!("Could not normalize the document's global vector")
        }
        Ok(DocumentEmbedding {
            global_vector: average
                .into_iter()
                .map(|value| (value / norm) as f32)
                .collect(),
            chunks: embedded,
        })
    }

    /// Returns the dimension of this model's sentence embeddings.
    pub fn dimensions(&self) -> usize {
        self.dimensions
    }

    /// The token limit used by the model, including special tokens.
    pub fn max_tokens(&self) -> usize {
        self.max_tokens
    }
}

/// Computes cosine similarity between two vectors.
pub fn cosine_similarity(first: &[f32], second: &[f32]) -> Result<f32> {
    if first.is_empty() || first.len() != second.len() {
        bail!("Embedding vectors must have the same non-zero dimension")
    }
    let dot = first.iter().zip(second).map(|(a, b)| a * b).sum::<f32>();
    let first_norm = first.iter().map(|value| value * value).sum::<f32>().sqrt();
    let second_norm = second.iter().map(|value| value * value).sum::<f32>().sqrt();
    if first_norm == 0. || second_norm == 0. {
        bail!("Cannot compare a zero-length embedding vector")
    }
    Ok(dot / (first_norm * second_norm))
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
            // Only an unknown cache entry needs a download. A cached record
            // that an optional file does not exist must not trigger a new check.
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

fn validate_bert_architecture(config: &Value) -> Result<()> {
    if config.get("model_type").and_then(Value::as_str) != Some("bert") {
        bail!("This implementation supports BERT models only; the selected model has another architecture")
    }
    let has_bert_model = config
        .get("architectures")
        .and_then(Value::as_array)
        .is_some_and(|architectures| {
            architectures
                .iter()
                .any(|name| name.as_str() == Some("BertModel"))
        });
    if !has_bert_model {
        bail!("The selected model does not declare the supported `BertModel` architecture")
    }
    Ok(())
}

fn validate_mean_pooling(path: &std::path::Path) -> Result<()> {
    let config: Value = serde_json::from_slice(
        &std::fs::read(path).context("Could not read the pooling configuration")?,
    )?;
    let mean_pooling = config
        .get("pooling_mode_mean_tokens")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let other_pooling = [
        "pooling_mode_cls_token",
        "pooling_mode_max_tokens",
        "pooling_mode_mean_sqrt_len_tokens",
        "pooling_mode_weightedmean_tokens",
        "pooling_mode_lasttoken",
    ]
    .iter()
    .any(|key| config.get(key).and_then(Value::as_bool).unwrap_or(false));
    if !mean_pooling || other_pooling {
        bail!("This implementation requires a sentence-transformers pooling configuration with mean token pooling only")
    }
    Ok(())
}

fn normalize_l2(vectors: &Tensor) -> candle_core::Result<Tensor> {
    Ok(vectors.broadcast_div(&vectors.sqr()?.sum_keepdim(1)?.sqrt()?)?)
}
