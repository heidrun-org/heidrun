//! The command line tool: reads a request of the System One API and writes the response as JSON.

use std::io::Read;
use std::path::PathBuf;
use std::time::Instant;

use anyhow::{bail, Context as _, Result};
use clap::{Parser, Subcommand, ValueEnum};
use localai_decisions_qwen35::{DecisionConfig, DecisionEngine, Device, DEFAULT_MODEL};
use serde_json::{json, Map, Value};

/// Answers the questions of a request with a decision model based on Qwen3.5, on this computer.
#[derive(Parser, Debug)]
#[command(version, about)]
struct Arguments {
    #[command(subcommand)]
    command: Option<Command>,

    /// A Hugging Face repository, with an optional quantization after a colon, or a local `.gguf` file.
    #[arg(long, global = true, default_value = DEFAULT_MODEL)]
    model: String,

    /// A JSON file with the request (`state` and `questions`). Without it and without --text, the request
    /// is read from standard input.
    #[arg(long, conflicts_with = "text")]
    request: Option<PathBuf>,

    /// A short form of a request: the state, used with --question and --choices.
    #[arg(long, requires = "question")]
    text: Option<String>,

    /// The question of the short form.
    #[arg(long, requires = "text")]
    question: Option<String>,

    /// The options of the short form, separated by commas; without them the question is a yes or no question.
    #[arg(long, value_delimiter = ',', requires = "question")]
    choices: Vec<String>,

    /// Where the model runs: `gpu` needs a build with the feature metal, cuda, or vulkan.
    #[arg(long, visible_alias = "backend", global = true, value_enum, default_value_t = DeviceArgument::Cpu)]
    device: DeviceArgument,

    /// The number of processor threads; by default, the number of performance cores, at most 8.
    #[arg(long, global = true)]
    threads: Option<i32>,

    /// The largest number of tokens of one evaluation; one prompt must fit in it.
    #[arg(long, global = true, default_value_t = 2048)]
    batch_size: u32,

    /// Ask Hugging Face for a newer model file, even when the cache has one.
    #[arg(long, global = true)]
    check_model_updates: bool,

    /// Write the response in this file instead of standard output.
    #[arg(long, global = true)]
    output: Option<PathBuf>,

    /// Print the logs of llama.cpp, the loading time, and the time of the decision on standard error.
    #[arg(long, global = true)]
    verbose: bool,
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum DeviceArgument {
    Cpu,
    Gpu,
}

mod benchmark;

#[derive(Debug, Subcommand)]
enum Command {
    /// Measure warmed-up decisions per second on built-in short and long text cases.
    Benchmark(benchmark::Arguments),
}

fn main() {
    if let Err(error) = run() {
        eprintln!("Error: {error:#}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let mut arguments = Arguments::parse();
    if let Some(Command::Benchmark(benchmark)) = arguments.command.take() {
        return benchmark::run(
            benchmark,
            DecisionConfig {
                model: arguments.model.clone(),
                device: match arguments.device {
                    DeviceArgument::Cpu => Device::Cpu,
                    DeviceArgument::Gpu => Device::Gpu,
                },
                threads: arguments.threads,
                batch_size: arguments.batch_size,
                check_model_updates: arguments.check_model_updates,
                verbose: arguments.verbose,
            },
            arguments.output,
        );
    }
    let request = read_request(&arguments)?;

    let started = Instant::now();
    let engine = DecisionEngine::load(DecisionConfig {
        model: arguments.model.clone(),
        device: match arguments.device {
            DeviceArgument::Cpu => Device::Cpu,
            DeviceArgument::Gpu => Device::Gpu,
        },
        threads: arguments.threads,
        batch_size: arguments.batch_size,
        check_model_updates: arguments.check_model_updates,
        verbose: arguments.verbose,
    })?;
    if arguments.verbose {
        eprintln!(
            "Loaded {} (type {}) in {} ms",
            engine.model_path().display(),
            engine.decision_type().name(),
            started.elapsed().as_millis()
        );
    }

    let started = Instant::now();
    let response = engine.decide(&request)?;
    if arguments.verbose {
        eprintln!("Answered in {} ms", started.elapsed().as_millis());
    }

    let text = serde_json::to_string_pretty(&response)? + "\n";
    match &arguments.output {
        Some(path) => std::fs::write(path, text)
            .with_context(|| format!("Could not write {}", path.display()))?,
        None => print!("{text}"),
    }
    Ok(())
}

fn read_request(arguments: &Arguments) -> Result<Value> {
    if let Some(text) = &arguments.text {
        let question = arguments.question.clone().unwrap_or_default();
        let mut criteria = Map::new();
        for choice in arguments
            .choices
            .iter()
            .map(|c| c.trim())
            .filter(|c| c.is_empty() == false)
        {
            criteria.insert(choice.to_string(), Value::Null);
        }
        let question_value = if criteria.is_empty() {
            json!({
                "type": "noul",
                "instructions": question,
            })
        } else {
            json!({
                "type": "choice",
                "instructions": question,
                "criteria": criteria,
            })
        };
        return Ok(json!({
            "state": text,
            "questions": {
                "question": question_value,
            },
        }));
    }

    let content = match &arguments.request {
        Some(path) => std::fs::read_to_string(path)
            .with_context(|| format!("Could not read {}", path.display()))?,
        None => {
            let mut content = String::new();
            std::io::stdin()
                .read_to_string(&mut content)
                .context("Could not read standard input")?;
            content
        }
    };
    if content.trim().is_empty() {
        bail!("No request: give --request, --text, or a JSON request on standard input");
    }
    serde_json::from_str(&content).context("The request is not valid JSON")
}
