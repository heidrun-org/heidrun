# Directory Context: `/packages/experiments/localai_decisions_candle/src`

## Purpose
This folder holds the public decision library and the command line tool.

## Key Exports & Entry Points
- `lib.rs`: the public library interface: `DecisionEngine` (loads the model files, `decide`, `encode`), `DecisionConfig`, `Backend`, and the types `DecisionTask`, `DecisionLabel`, `LabelScore`, and `TaskDecision`.
- `main.rs`: the command line tool, which reads texts from arguments, files, or standard input and writes JSON.
- `prompt.rs`, `words.rs`, `task.rs`, `model.rs`: the parts of the library, public only for the tests: the input of the model, the splitting of words, the choice of labels, and the neural network.

- `benchmark.rs`: the command line subcommand `benchmark`, with short and long input cases, warmup, throughput, and peak process resident memory.

## Rules
- The layout of the input of the model (`prompt.rs`) and the splitting of words (`words.rs`) reproduce the Python package gliner2 character for character, and the tests in `tests/` prove it.
- One pass of the encoder answers every task of one text.
- A single choice turns the logits into shares that add up to 1; a multiple choice turns each logit into its own probability.
- `model.rs` refuses an input above the number of positions of the encoder, because Candle builds its position table with that size.

- Benchmark timers exclude model loading and warmup, measure the requested number of fully completed decisions and report total time, average seconds per decision, and decisions per second, and never replace the selected backend.

## Background
- The Python code that `prompt.rs`, `words.rs`, and `task.rs` reproduce is in the package gliner2: `processor.py`, `processing/word_splitter.py`, and `inference/runtime.py`.
