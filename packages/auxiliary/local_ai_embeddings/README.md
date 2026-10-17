# Local AI embeddings

`local_ai_embeddings` computes text embeddings on your computer with a Rust library and command line tool. It accepts ordinary text or source code as text. It does not send text to a hosted model. This first version handles text only. The first run downloads the selected model from Hugging Face into the normal Hugging Face cache; later runs can use the cached files offline.

## Requirements

- Rust and Cargo.
- A CPU for the default backend.
- Internet access on the first run to download the model files.

## Compute an embedding

Run the command line tool with text, a file, or a pipe:

```bash
pnpm --filter local_ai_embeddings cli --text "Bonjour, ceci est un exemple."
pnpm --filter local_ai_embeddings cli --file ./notes.txt
cat ./notes.txt | pnpm --filter local_ai_embeddings cli
```

The output is JSON with the model name, backend, vector dimension, input text, and embedding vector. Use `--output result.json` to save the JSON to a file. With no text, file, or pipe, the command line tool prompts for text; paste text and press Control-D on a new line to finish.

Use `--compare` with exactly two text inputs or files to get their cosine similarity:

```bash
pnpm --filter local_ai_embeddings cli --compare \
  --text "The cat sleeps on the chair." \
  --text "A cat is resting on a seat."
```

## Select a model and backend

The default model is `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. Choose another supported Hugging Face model with `--model <model-id>`. This first version supports BERT sentence embedding models with `model.safetensors` weights and mean pooling. If a Sentence Transformers mean-pooling configuration is present, the tool checks it; if the configuration is missing, the tool uses mean pooling. Other architectures or pooling configurations produce a clear error.

The default backend is `cpu`. `--backend metal` requires a macOS build made with `--features metal`. `--backend cuda` requires a CUDA build made with `--features cuda` and a compatible NVIDIA GPU. The native command line tool reports that `wasm` needs a separate browser build and is not available as a native backend.

```bash
pnpm --filter local_ai_embeddings cli --backend cpu --text "Text to embed"
cargo run --features metal -- --backend metal --text "Text to embed"
cargo run --features cuda -- --backend cuda --text "Text to embed"
```

The model is approximately 450 MiB. Allow roughly 500 MiB for its cached files.
