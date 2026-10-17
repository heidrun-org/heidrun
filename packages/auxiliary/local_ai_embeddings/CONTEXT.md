# Directory Context: `/packages/auxiliary/local_ai_embeddings`

## Purpose
This package computes text embeddings locally. The Rust library can be used by Heidrun, and the command line tool supports direct text, standard input, and file paths.

## Key Exports & Entry Points
- `src/lib.rs`: the public Rust library interface for loading a model, embedding text, and comparing embeddings.
- `src/main.rs`: the `local_ai_embeddings` command line tool.
- `README.md`: installation and use.
- Command to run this folder: `pnpm --filter local_ai_embeddings cli`

## Rules
- Model inference stays on the selected local backend and does not send input text to a hosted inference service.
- The package does not depend on a package in `packages/apps`.
- Model identifiers may select only architectures and pooling configurations that this package supports.

## Background
- The package comes from [issue #631](https://github.com/heidrun-org/heidrun/issues/631).
