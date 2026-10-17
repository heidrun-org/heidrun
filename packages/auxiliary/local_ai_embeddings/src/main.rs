use anyhow::{bail, Context, Result};
use clap::Parser;
use local_ai_embeddings::{
    cosine_similarity, Backend, EmbeddingConfig, EmbeddingEngine, TextEmbedding, DEFAULT_MODEL_ID,
};
use serde::Serialize;
use std::io::{IsTerminal, Read, Write};
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(
    name = "local_ai_embeddings",
    about = "Compute text embeddings locally"
)]
struct Arguments {
    /// Hugging Face model identifier for a supported BERT sentence embedding model.
    #[arg(long, default_value = DEFAULT_MODEL_ID)]
    model: String,
    /// Local inference backend.
    #[arg(long, value_enum, default_value = "cpu")]
    backend: Backend,
    /// Text to embed. Repeat for multiple inputs.
    #[arg(long = "text", short = 't')]
    texts: Vec<String>,
    /// UTF-8 text file to embed. Repeat for multiple files.
    #[arg(long = "file", short = 'f')]
    files: Vec<PathBuf>,
    /// Compare exactly two inputs and return their cosine similarity.
    #[arg(long)]
    compare: bool,
    /// Save JSON output to a file instead of standard output.
    #[arg(long)]
    output: Option<PathBuf>,
}

#[derive(Serialize)]
struct EmbeddingOutput<'a> {
    model: &'a str,
    backend: &'static str,
    dimensions: usize,
    embeddings: Vec<TextEmbedding>,
}

#[derive(Serialize)]
struct SimilarityOutput<'a> {
    model: &'a str,
    backend: &'static str,
    dimensions: usize,
    first_text: String,
    second_text: String,
    cosine_similarity: f32,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("Error: {error:#}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let arguments = Arguments::parse();
    let texts = read_inputs(&arguments)?;
    if arguments.compare && texts.len() != 2 {
        bail!("`--compare` requires exactly two text inputs or files")
    }

    let mut engine = EmbeddingEngine::load(EmbeddingConfig {
        model_id: arguments.model,
        backend: arguments.backend,
    })?;
    let output = if arguments.compare {
        let embeddings = engine.embed(&texts)?;
        let similarity = cosine_similarity(&embeddings[0].vector, &embeddings[1].vector)?;
        serde_json::to_vec_pretty(&SimilarityOutput {
            model: engine.model_id(),
            backend: engine.backend().as_str(),
            dimensions: engine.dimensions(),
            first_text: embeddings[0].text.clone(),
            second_text: embeddings[1].text.clone(),
            cosine_similarity: similarity,
        })?
    } else {
        let embeddings = engine.embed(&texts)?;
        serde_json::to_vec_pretty(&EmbeddingOutput {
            model: engine.model_id(),
            backend: engine.backend().as_str(),
            dimensions: engine.dimensions(),
            embeddings,
        })?
    };

    if let Some(path) = arguments.output {
        std::fs::write(&path, output)
            .with_context(|| format!("Could not write `{}`", path.display()))?;
        eprintln!("Saved embedding output to {}", path.display());
    } else {
        std::io::stdout().write_all(&output)?;
        println!();
    }
    Ok(())
}

fn read_inputs(arguments: &Arguments) -> Result<Vec<String>> {
    let mut inputs = arguments.texts.clone();
    for path in &arguments.files {
        inputs.push(
            std::fs::read_to_string(path)
                .with_context(|| format!("Could not read UTF-8 text from `{}`", path.display()))?,
        );
    }
    if !inputs.is_empty() {
        return Ok(inputs);
    }

    if std::io::stdin().is_terminal() {
        eprintln!("Paste text, then press Control-D on a new line to compute its embedding.");
    } else {
        eprintln!("Reading text from standard input.");
    }
    let mut input = String::new();
    std::io::stdin()
        .read_to_string(&mut input)
        .context("Could not read text from standard input")?;
    if input.trim().is_empty() {
        bail!("No text was provided")
    }
    Ok(vec![input])
}
