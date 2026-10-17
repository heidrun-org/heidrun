# Directory Context: `/packages/auxiliary/local_ai_embeddings/src`

## Purpose
This folder contains the public embedding library and the command line interface.

## Key Exports & Entry Points
- `lib.rs`: model loading, CPU and optional accelerator selection, embedding, and similarity calculation.
- `main.rs`: reads text from arguments, standard input, or files and writes JSON output.

## Rules
- Validate that a selected model is a supported BERT sentence embedding model before loading its weights.
- Apply the tokenizer attention mask during mean pooling and normalize vectors before comparing them.
- Keep model inference local to the selected device.

## Background
- The package comes from [issue #631](https://github.com/heidrun-org/heidrun/issues/631).
