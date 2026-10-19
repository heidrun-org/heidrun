# Directory Context: `/packages/experiments/localai_decisions_candle/tests`

## Purpose
This folder holds the Rust tests of the package, and the results of the Python package gliner2 that the tests compare with.

## Key Exports & Entry Points
- `python_reference.rs`: compares the token identifiers, the logits, the probabilities, and the chosen labels with the Python results.
- `word_splitting.rs`: compares the words with the words of the Python word splitter. It needs no model.
- `command_line.rs`: runs the compiled command line tool.
- `limits_and_errors.rs`: the token limit, the empty task list, and the refused backend.
- `fixtures/`: `examples.json` (texts and tasks), `python_reference.json` (the Python results), and `word_splits.json`.
- Command to run this folder: `pnpm --filter localai_decisions_candle test`

## Rules
- The tests need the model fastino/GLiNER2.5-Decide in the Hugging Face cache, and the first run downloads it (1.9 GB).
- Never edit `python_reference.json` or the `words` of `word_splits.json` by hand; run the script in `python_reference/`.
- A new example goes into `examples.json`, then the script writes its Python results.

## Background
- The tolerance of the comparison is in `python_reference.rs`; the measured largest difference is in the README of the package.
