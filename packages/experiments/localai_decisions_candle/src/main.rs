use anyhow::{bail, Context, Result};
use clap::Parser;
use localai_decisions_candle::{
    Backend, DecisionConfig, DecisionEngine, DecisionTask, TaskDecision, DEFAULT_MODEL_ID,
    DEFAULT_MULTI_LABEL_THRESHOLD,
};
use serde::Serialize;
use std::io::{IsTerminal, Read, Write};
use std::path::PathBuf;
use std::time::Instant;

const DEFAULT_TASK_NAME: &str = "decision";

#[derive(Debug, Parser)]
#[command(
    name = "localai_decisions_candle",
    about = "Choose the label that matches a text, locally, with the decision model GLiNER2.5-Decide"
)]
struct Arguments {
    /// Hugging Face identifier of a GLiNER2 decision model with the `span` architecture and a DeBERTa v2 encoder.
    #[arg(long, default_value = DEFAULT_MODEL_ID)]
    model: String,
    /// Check Hugging Face for model updates and download newer files if available.
    #[arg(long)]
    check_model_updates: bool,
    /// Local inference backend.
    #[arg(long, value_enum, default_value = "cpu")]
    backend: Backend,
    /// Text to classify. Repeat for multiple texts.
    #[arg(long = "text", short = 't')]
    texts: Vec<String>,
    /// UTF-8 text file to classify. Repeat for multiple files.
    #[arg(long = "file", short = 'f')]
    files: Vec<PathBuf>,
    /// The labels to choose from, separated by commas, for example `refund_request,cancel_subscription,other`.
    #[arg(long, value_delimiter = ',', conflicts_with = "tasks_file")]
    labels: Vec<String>,
    /// The name of the decision that `--labels` describes. The model reads the name.
    #[arg(long, default_value = DEFAULT_TASK_NAME, conflicts_with = "tasks_file")]
    task_name: String,
    /// A question or instruction that the model reads together with the name of the decision.
    #[arg(long, conflicts_with = "tasks_file")]
    prompt: Option<String>,
    /// Choose every label above the threshold instead of the single best label.
    #[arg(long, conflicts_with = "tasks_file")]
    multi_label: bool,
    /// The probability that a label needs when `--multi-label` is used.
    #[arg(long, default_value_t = DEFAULT_MULTI_LABEL_THRESHOLD, conflicts_with = "tasks_file")]
    threshold: f32,
    /// The largest number of labels to return when `--multi-label` is used.
    #[arg(long, conflicts_with = "tasks_file")]
    top_k: Option<usize>,
    /// A JSON file with a list of decision tasks, to take several decisions about each text in one pass.
    #[arg(long)]
    tasks_file: Option<PathBuf>,
    /// Save JSON output to a file instead of standard output.
    #[arg(long)]
    output: Option<PathBuf>,
    /// Print progress and timing details to standard error.
    #[arg(short, long)]
    verbose: bool,
}

struct Input {
    source: String,
    text: String,
}

#[derive(Serialize)]
struct TextOutput<'a> {
    source: &'a str,
    text: &'a str,
    decisions: Vec<TaskDecision>,
}

#[derive(Serialize)]
struct DecisionOutput<'a> {
    model: &'a str,
    backend: &'static str,
    results: Vec<TextOutput<'a>>,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("Error: {error:#}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let arguments = Arguments::parse();
    let tasks = read_tasks(&arguments)?;
    let inputs = read_inputs(&arguments)?;

    if arguments.verbose {
        eprintln!(
            "Loading model `{}` on the `{}` backend...",
            arguments.model,
            arguments.backend.as_str()
        );
    }
    let load_started = Instant::now();
    let engine = DecisionEngine::load(DecisionConfig {
        model_id: arguments.model.clone(),
        backend: arguments.backend,
        check_model_updates: arguments.check_model_updates,
    })?;
    if arguments.verbose {
        eprintln!(
            "Loaded `{}` in {:.2} seconds.",
            engine.model_id(),
            load_started.elapsed().as_secs_f64()
        );
    }

    let mut decisions_per_input = Vec::with_capacity(inputs.len());
    for input in &inputs {
        let decide_started = Instant::now();
        decisions_per_input.push(engine.decide(&input.text, &tasks)?);
        if arguments.verbose {
            eprintln!(
                "Decided `{}` in {:.2} seconds.",
                input.source,
                decide_started.elapsed().as_secs_f64()
            );
        }
    }

    let output = serde_json::to_vec_pretty(&DecisionOutput {
        model: engine.model_id(),
        backend: engine.backend().as_str(),
        results: inputs
            .iter()
            .zip(decisions_per_input)
            .map(|(input, decisions)| TextOutput {
                source: &input.source,
                text: &input.text,
                decisions,
            })
            .collect(),
    })?;
    if let Some(path) = arguments.output {
        std::fs::write(&path, output)
            .with_context(|| format!("Could not write `{}`", path.display()))?;
        eprintln!("Saved decision output to {}", path.display());
    } else {
        std::io::stdout().write_all(&output)?;
        println!();
    }
    Ok(())
}

fn read_tasks(arguments: &Arguments) -> Result<Vec<DecisionTask>> {
    if let Some(path) = &arguments.tasks_file {
        let tasks: Vec<DecisionTask> = serde_json::from_slice(
            &std::fs::read(path).with_context(|| format!("Could not read `{}`", path.display()))?,
        )
        .with_context(|| format!("`{}` is not a JSON list of decision tasks", path.display()))?;
        if tasks.is_empty() {
            bail!("`{}` holds no decision task", path.display());
        }
        for task in &tasks {
            task.validate()?;
        }
        return Ok(tasks);
    }
    if arguments.labels.is_empty() {
        bail!("Give the labels to choose from with `--labels`, or a list of decision tasks with `--tasks-file`");
    }
    let mut task = DecisionTask::new(
        arguments.task_name.clone(),
        arguments.labels.iter().map(|label| label.trim()),
    );
    task.prompt = arguments.prompt.clone();
    if arguments.multi_label {
        task = task.with_multi_label(arguments.threshold);
    }
    task.top_k = arguments.top_k;
    task.validate()?;
    Ok(vec![task])
}

fn read_inputs(arguments: &Arguments) -> Result<Vec<Input>> {
    let mut inputs = arguments
        .texts
        .iter()
        .enumerate()
        .map(|(index, text)| Input {
            source: format!("text:{}", index + 1),
            text: text.clone(),
        })
        .collect::<Vec<_>>();
    for path in &arguments.files {
        if arguments.verbose {
            eprintln!("Reading `{}`...", path.display());
        }
        let text = std::fs::read_to_string(path)
            .with_context(|| format!("Could not read UTF-8 text from `{}`", path.display()))?;
        inputs.push(Input {
            source: path.display().to_string(),
            text,
        });
    }
    if !inputs.is_empty() {
        return Ok(inputs);
    }
    if std::io::stdin().is_terminal() {
        eprintln!("Paste text, then press Control-D on a new line to take the decision.");
    } else {
        eprintln!("Reading text from standard input.");
    }
    let mut text = String::new();
    std::io::stdin()
        .read_to_string(&mut text)
        .context("Could not read text from standard input")?;
    if text.trim().is_empty() {
        bail!("No text was provided");
    }
    Ok(vec![Input {
        source: "stdin".to_string(),
        text,
    }])
}
