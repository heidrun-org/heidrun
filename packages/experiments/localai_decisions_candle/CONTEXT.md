# Directory Context: `/packages/experiments/localai_decisions_candle`

## Purpose
This package runs the decision model GLiNER2.5-Decide on the computer with a Rust library and a command line tool. A decision model reads a text and a list of labels, and returns the label that matches the text with a probability. It writes no text.

## Key Exports & Entry Points
- `src/`: the Rust library and the command line tool. See its own CONTEXT.md.
- `tests/`: the Rust tests, and the results of the Python package gliner2 that they compare with. See its own CONTEXT.md.
- `python_reference/`: the script that writes the Python results. See its own CONTEXT.md.
- `README.md`: installation and use.
- Command to run this folder: `pnpm --filter localai_decisions_candle cli --text "<text>" --labels <label>,<label>`
- Command to measure speed: `pnpm --filter localai_decisions_candle cli benchmark`
- Command to test this folder: `pnpm --filter localai_decisions_candle test`

## Rules
- Model inference stays on the selected local backend and does not send the input text to a hosted inference service.
- The package loads the model type `gliner2` with the architecture `span` and a DeBERTa v2 encoder only, and refuses every other model with an error that names the unsupported part.
- A change of the code that builds the input of the model or computes a logit must keep the tests against the Python results green.
- Cached model files are used immediately by default; `--check-model-updates` explicitly requests an online check.
- The package depends on no other package of this repository, and no package outside `packages/experiments` imports it.

## Background
- The package comes from [issue #717](https://github.com/heidrun-org/heidrun/issues/717).
- The package follows the libraries and the layout of `packages/experiments/localai_embeddings`, from [issue #631](https://github.com/heidrun-org/heidrun/issues/631).
