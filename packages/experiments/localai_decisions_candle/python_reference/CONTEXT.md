# Directory Context: `/packages/experiments/localai_decisions_candle/python_reference`

## Purpose
This folder holds the Python script that runs the package gliner2 on the examples of `tests/fixtures/examples.json` and writes the results that the Rust tests compare with.

## Key Exports & Entry Points
- `generate_python_reference.py`: writes `tests/fixtures/python_reference.json` and the `words` of `tests/fixtures/word_splits.json`.
- Command to run this folder: see the first lines of `generate_python_reference.py`; it needs `gliner2[local]` in a virtual environment outside the repository.

## Rules
- The script runs only to refresh the fixtures; no test and no command of the package starts Python.
- The virtual environment never goes into the repository.

## Background
- The script comes from [issue #717](https://github.com/heidrun-org/heidrun/issues/717), whose first test compares the Rust results with the Python results.
