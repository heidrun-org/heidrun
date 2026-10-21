//! Runs the decision models based on Qwen3.5 on the computer, with llama.cpp.
//!
//! A decision model reads a text (the "state") and typed questions with their options. It returns a
//! probability for each option, in one pass, and writes no text. The request and the answer follow the
//! System One API of TypeSafe, as the endpoint `/v1/systemone` of the server of llama.cpp.

pub mod decision;
pub mod llama;
pub mod template;

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use anyhow::{bail, Context as _, Result};
use hf_hub::{HFClientSync, HFError};
use serde_json::{json, Map, Value};

use crate::decision::{DecisionSetup, DecisionType, PromptTask};
use crate::llama::{Context, ContextSettings, Model};

pub use crate::llama::Device;

/// The model that the package uses when the caller names none: the smallest, with the Apache 2.0 license.
pub const DEFAULT_MODEL: &str = "ggml-org/Kev-0.8B-GGUF";

/// The quantization that the package uses when the model name gives none.
pub const DEFAULT_QUANTIZATION: &str = "Q8_0";

/// The settings of a decision engine.
#[derive(Clone, Debug)]
pub struct DecisionConfig {
    /// A Hugging Face repository with an optional quantization, for example `ggml-org/lev-GGUF:Q4_K_M`,
    /// or the path of a local `.gguf` file.
    pub model: String,
    /// Where the model runs.
    pub device: Device,
    /// The number of processor threads; `None` uses the number of performance cores, at most 8.
    pub threads: Option<i32>,
    /// The largest number of tokens of one evaluation; one prompt must fit in it.
    pub batch_size: u32,
    /// True to ask Hugging Face for a newer model file, even when the cache has one.
    pub check_model_updates: bool,
    /// True to print the logs of llama.cpp on standard error.
    pub verbose: bool,
}

impl Default for DecisionConfig {
    fn default() -> Self {
        Self {
            model: DEFAULT_MODEL.to_string(),
            device: Device::Cpu,
            threads: None,
            batch_size: 2048,
            check_model_updates: false,
            verbose: false,
        }
    }
}

/// A loaded decision model, ready to answer requests.
pub struct DecisionEngine {
    model_name: String,
    model_path: PathBuf,
    model: Arc<Model>,
    setup: DecisionSetup,
    context: Mutex<Context>,
    config: DecisionConfig,
}

impl DecisionEngine {
    /// Finds the model file (in the Hugging Face cache, or downloads it), and loads it.
    pub fn load(config: DecisionConfig) -> Result<Self> {
        if config.device == Device::Gpu && llama::has_gpu_backend() == false {
            bail!("This build has no GPU backend; build with the feature metal, cuda, or vulkan (see README.md)");
        }
        if config.batch_size == 0 {
            bail!("The batch size must be at least 1");
        }
        let model_path = resolve_model_file(&config.model, config.check_model_updates)?;
        let model = Arc::new(Model::load(&model_path, config.device, config.verbose)?);
        let setup = DecisionSetup::new(&model)?;
        let threads = config.threads.unwrap_or_else(default_threads);
        // One prompt at a time: several prompts in one batch were not faster, and the recurrent layers of
        // Qwen3.5 then give other last digits than the server, which answers each question alone.
        let settings = ContextSettings {
            n_ctx: config.batch_size,
            n_batch: config.batch_size,
            n_seq_max: 1,
            n_threads: threads,
            embeddings: setup.decision_type.reads_embeddings(),
        };
        let context = Context::new(model.clone(), settings)?;
        Ok(Self {
            model_name: config.model.clone(),
            model_path,
            model,
            setup,
            context: Mutex::new(context),
            config,
        })
    }

    /// The decision type of the loaded model.
    pub fn decision_type(&self) -> DecisionType {
        self.setup.decision_type
    }

    /// The path of the loaded model file.
    pub fn model_path(&self) -> &Path {
        &self.model_path
    }

    /// Answers a request of the System One API, and returns the response of the API.
    ///
    /// The request is a JSON object with `state` and `questions`; the response has `model`, `answers`, and
    /// `usage`, as the endpoint `/v1/systemone` of the server of llama.cpp.
    pub fn decide(&self, request: &Value) -> Result<Value> {
        let questions = self.setup.parse_questions(request)?;
        let state = &request["state"];

        let mut tasks = Vec::new();
        if self.setup.decision_type == DecisionType::Clef {
            tasks.push(self.setup.fill_task_joint(&self.model, state, &questions)?);
        } else {
            for question in &questions {
                for variant in 0..self.setup.n_variants(question) {
                    tasks.push(self.setup.fill_task(&self.model, state, &questions, question, variant)?);
                }
            }
        }
        let input_tokens: usize = tasks.iter().map(|t| t.tokens.len()).sum();
        let scores = self.evaluate(&tasks)?;

        let mut answers = Map::new();
        let mut i_result = 0;
        let mut i_score = 0;
        for question in &questions {
            let question_scores: Vec<Vec<f32>> = if self.setup.decision_type == DecisionType::Clef {
                // The scores of the joint prompt are in the order of the options of all the questions.
                let n = question.options.len();
                let slice = scores[0][i_score..i_score + n].to_vec();
                i_score += n;
                vec![slice]
            } else {
                let n = self.setup.n_variants(question);
                let slice = scores[i_result..i_result + n].to_vec();
                i_result += n;
                slice
            };
            answers.insert(question.id.clone(), self.setup.format_answer(question, &question_scores)?);
        }

        Ok(json!({
            "model": self.model_name,
            "answers": answers,
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": 0,
            },
        }))
    }

    /// Evaluates the prompts one by one, and returns the raw scores of each prompt.
    fn evaluate(&self, tasks: &[PromptTask]) -> Result<Vec<Vec<f32>>> {
        let n_batch = self.config.batch_size as usize;
        for task in tasks {
            if task.tokens.is_empty() {
                bail!("The prompt of a question is empty");
            }
            if task.tokens.len() > n_batch {
                bail!(
                    "A prompt has {} tokens, more than the batch size of {n_batch}; give a larger --batch-size",
                    task.tokens.len()
                );
            }
        }

        let mut context = self.context.lock().map_err(|_| anyhow::anyhow!("The llama.cpp context is poisoned"))?;
        let mut batch = context.batch()?;
        let mut results = Vec::with_capacity(tasks.len());
        for task in tasks {
            context.clear();
            batch.clear();
            let last = task.tokens.len() - 1;
            let mut indices = Vec::with_capacity(task.tokens.len());
            for (pos, token) in task.tokens.iter().enumerate() {
                let output = match self.setup.decision_type {
                    DecisionType::Kev => pos == last || task.markers.contains(&pos),
                    DecisionType::Clef => true,
                    _ => pos == last,
                };
                let order = task.order.get(pos).copied().unwrap_or(0);
                indices.push(batch.add(*token, 0, pos as i32, output, order)?);
            }
            context.process(&batch)?;
            results.push(self.read_scores(&context, task, &indices)?);
        }
        Ok(results)
    }

    /// Reads the raw scores of one prompt, as `send_decision` of the server does.
    fn read_scores(&self, context: &Context, task: &PromptTask, indices: &[i32]) -> Result<Vec<f32>> {
        if task.labels.is_empty() == false {
            let logits = context.logits(indices[indices.len() - 1])?;
            return Ok(task.labels.iter().map(|label| logits[*label as usize]).collect());
        }

        let mut scores = Vec::new();
        // Joint head (clef): the scores are the first rows.
        for idx in indices.iter().take(task.n_scores) {
            scores.push(context.embeddings(*idx)?[0]);
        }
        if let Some(pointer) = task.pointer {
            let n_pointer = self.model.n_embd_out() / 2;
            let question = context.embeddings(indices[pointer])?.to_vec();
            for marker in &task.markers {
                let option = context.embeddings(indices[*marker])?;
                let mut dot = 0.0f32;
                for i in 0..n_pointer {
                    dot += question[i] * option[n_pointer + i];
                }
                scores.push(dot / (n_pointer as f32).sqrt());
            }
        }
        Ok(scores)
    }
}

/// The default number of processor threads: all threads on the efficiency cores of an Apple processor
/// slow the evaluation down, so the default is the number of performance cores, at most 8.
pub fn default_threads() -> i32 {
    let all = std::thread::available_parallelism().map_or(4, |n| n.get() as i32);
    let performance = std::process::Command::new("sysctl")
        .args(["-n", "hw.perflevel0.physicalcpu"])
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|text| text.trim().parse::<i32>().ok())
        .unwrap_or(all);
    performance.clamp(1, 8).min(all)
}

/// Finds the GGUF file of a model: a local path, or a file of a Hugging Face repository.
///
/// A repository name `owner/Name-GGUF` with the quantization `Q` gives the file `Name-Q.gguf`, as the
/// repositories of ggml-org name their files. The cache is used first, without a network request.
pub fn resolve_model_file(model: &str, check_model_updates: bool) -> Result<PathBuf> {
    let path = Path::new(model);
    if model.ends_with(".gguf") {
        if path.is_file() == false {
            bail!("The model file {model} does not exist");
        }
        return Ok(path.to_path_buf());
    }

    let (repository, quantization) = model.split_once(':').unwrap_or((model, DEFAULT_QUANTIZATION));
    let Some((owner, name)) = repository.split_once('/') else {
        bail!("The model must be a `.gguf` file or a Hugging Face repository of the form `owner/name`, for example {DEFAULT_MODEL}");
    };
    if owner.is_empty() || name.is_empty() || name.contains('/') || quantization.is_empty() {
        bail!("The model must be a `.gguf` file or a Hugging Face repository of the form `owner/name[:quantization]`");
    }
    let base = name.strip_suffix("-GGUF").unwrap_or(name);
    let filename = format!("{base}-{quantization}.gguf");

    let client = HFClientSync::new().context("Could not initialize the Hugging Face model cache")?;
    let repo = client.model(owner.to_string(), name.to_string());
    if check_model_updates == false {
        match repo
            .download_file()
            .filename(filename.clone())
            .revision("main".to_string())
            .local_files_only(true)
            .send()
        {
            Ok(path) => return Ok(path),
            Err(HFError::LocalEntryNotFound { .. }) => {}
            Err(error) => return Err(error).with_context(|| format!("Could not read the cached model file `{filename}`")),
        }
    }
    repo.download_file()
        .filename(filename.clone())
        .revision("main".to_string())
        .send()
        .with_context(|| format!("Could not download `{filename}` from the repository {repository}"))
}
