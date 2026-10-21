# Directory Context: `/packages/experiments/localai_embeddings/src`

## Purpose
This folder contains the public embedding library and the command line interface.

## Key Exports & Entry Points
- `lib.rs`: model loading with optional stage timings, CPU and optional accelerator selection, embedding, and similarity calculation.
- `main.rs`: reads text from arguments, standard input, or files, reports optional verbose progress, and writes JSON output.
- `chunking.rs`: selects structural boundaries and splits oversized blocks at tokenizer boundaries.

## Rules
- Validate that a selected model is a supported BERT sentence embedding model before loading its weights.
- Apply the tokenizer attention mask during mean pooling and normalize vectors before comparing them.
- Keep model inference local to the selected device.
- Use cached model files immediately unless `EmbeddingConfig::check_model_updates` is enabled, and download files only when the cache has no entry.
- Whole documents produce a vector for every chunk and a normalized global vector, and chunk overlap defaults to zero.
- Keep chunks within the Sentence Transformers token limit, bounded by the model architecture limit, and reject oversized inputs to the lower-level embedding method.

## Background
- The package comes from [issue #631](https://github.com/heidrun-org/heidrun/issues/631).
