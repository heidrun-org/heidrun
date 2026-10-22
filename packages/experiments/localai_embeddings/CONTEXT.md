# Directory Context: `/packages/experiments/localai_embeddings`

## Purpose
This experiment computes text embeddings locally for future evaluation. Its Rust library and command line tool support direct text, standard input, file paths, document chunking, benchmarks, and verbose progress details.

## Key Exports & Entry Points
- `src/`: the public Rust library and the `localai_embeddings` command line tool. See its own CONTEXT.md.
- `README.md`: installation and use.
- Command to run this folder: `pnpm --filter localai_embeddings cli`

## Rules
- Model inference stays on the selected local backend and does not send input text to a hosted inference service.
- The package does not depend on a package in `packages/apps`.
- No package outside `packages/experiments` imports this package.
- Model identifiers may select only architectures and pooling configurations that this package supports.
- Cached model files are used immediately by default; `--check-model-updates` explicitly requests an online check.

## Background
- The package comes from [issue #631](https://github.com/heidrun-org/heidrun/issues/631).
