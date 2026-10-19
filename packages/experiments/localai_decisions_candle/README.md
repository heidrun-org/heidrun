# Local AI decisions

`localai_decisions_candle` runs the decision model GLiNER2.5-Decide on your computer, with a Rust library and a command line tool. The name ends with `candle` because the package runs the model with the Rust library Candle. A decision model reads a text and a list of labels. It returns the label that matches the text, with a probability. It writes no text. After the first download of the model files, the input text never leaves your computer.

For example, the text "My subscription renewed after the service was already down. Can I get that charge refunded?" with the labels `refund_request`, `cancel_subscription`, `login_problem`, and `other` gives `refund_request` with a probability of 0.996.

## Requirements

- Rust and Cargo.
- Internet access on the first run, to download the model files.
- About 2 GB of free disk space and about 2.5 GB of free memory.

The model is [fastino/GLiNER2.5-Decide](https://huggingface.co/fastino/GLiNER2.5-Decide): 340 million parameters, the Apache 2.0 license, and an English text classifier. Its files occupy 1.9 GB in the standard Hugging Face cache, normally `~/.cache/huggingface/hub`. Hugging Face cache environment variables can change that location. The tool uses cached files at once and downloads only the files that the cache does not have. Add `--check-model-updates` to ask Hugging Face for newer files.

## Take a decision

From the repository root, pass the text and the labels:

```bash
pnpm --filter localai_decisions_candle cli --text "My subscription renewed after the service was already down. Can I get that charge refunded?" --labels refund_request,cancel_subscription,login_problem,other
```

The text can also come from a file or from a pipe. `--text` and `--file` can be repeated, and the tool takes the decision for each text in turn:

```bash
pnpm --filter localai_decisions_candle cli --file ticket.txt --labels refund_request,other
cat ticket.txt | pnpm --filter localai_decisions_candle cli --labels refund_request,other
```

The package command runs inside the package folder, so a relative file path starts there. Use an absolute path for a file elsewhere.

The output is JSON. For each text, `decisions` has one entry for each decision. Each entry has the `task` name, the `chosen` labels, and the `scores` of all labels in the order that you gave them. Each score has the `label`, the `logit` (the raw output of the model), and the `probability`. Use `--output result.json` to save the output in a file, and `--verbose` to print the loading time and the time of each decision on standard error.

The first invocation compiles the program, which takes a few minutes. Later invocations reuse the compiled program.

### Name, question, and several labels

- `--task-name` is the name of the decision, for example `sentiment`. The model reads the name, so a name that fits the labels helps. The default name is `decision`.
- `--prompt "Did the treaty enter into force in 1992?"` gives the model a question or an instruction to read with the name.
- `--multi-label` returns every label whose probability reaches `--threshold` (0.5 by default) instead of one label. When no label reaches the threshold, the most probable label is returned. `--top-k 2` keeps at most two labels.

```bash
pnpm --filter localai_decisions_candle cli --text "Battery dies before lunch, but the keyboard and the screen are the best I have used on a laptop." --task-name aspects --labels battery,keyboard,screen,camera,price,support --multi-label --threshold 0.4
```

For one choice, the probabilities of all labels add up to 1. For several choices, each label has its own probability.

### Several decisions about one text

`--tasks-file tasks.json` takes a JSON list of decision tasks and answers all of them with one pass of the model. A label can have a `description` that tells the model what the label means:

```json
[
  {
    "name": "intent",
    "prompt": "What does the customer need?",
    "labels": [
      { "name": "card_replacement", "description": "The customer needs a new card" },
      { "name": "card_lost", "description": "The card is missing" }
    ]
  },
  {
    "name": "priority",
    "labels": [{ "name": "low" }, { "name": "normal" }, { "name": "high" }]
  }
]
```

```bash
pnpm --filter localai_decisions_candle cli --tasks-file tasks.json --text "The card was swallowed by the machine and I need a new one before Friday."
```

## Use the Rust library

```rust
use localai_decisions_candle::{DecisionConfig, DecisionEngine, DecisionTask};

let engine = DecisionEngine::load(DecisionConfig::default())?;
let task = DecisionTask::new("intent", ["refund_request", "cancel_subscription", "other"]);
let decisions = engine.decide("Can I get that charge refunded?", &[task])?;
println!("{}", decisions[0].chosen[0].label);
```

`DecisionEngine::load` reads the model files and takes a few seconds. Keep the engine and call `decide` for each text. `DecisionTask::with_prompt`, `with_description`, `with_multi_label`, and `with_top_k` set the options of the command line.

## Measure speed

Run the reusable benchmark directly through this package's command line:

```bash
pnpm --filter localai_decisions_candle cli benchmark
```

The command measures single-label and several-label decisions, each with a short text and a longer text. Each case completes five measured decisions by default. The model loads once, then each case completes a warmup before timing starts. Model loading and warmup are excluded from the speed measurement. Reading the returned probabilities completes GPU work before the timer starts.

The table shows the input token count, total measured seconds, average seconds per decision, and decisions per second. Every requested decision finishes, even when one decision takes longer than five seconds. Average seconds per decision is total measured time divided by the number of completed decisions; decisions per second is the number of completed decisions divided by total measured time. The JSON also records the requested and completed counts. Qwen token counts include the prompts used for one question, while Candle token counts include the encoded text and labels, so token counts from the two models are not directly comparable.

Useful options:

```bash
pnpm --filter localai_decisions_candle cli benchmark --decisions 10
pnpm --filter localai_decisions_candle cli benchmark --output /tmp/localai_decisions_candle-speed.json
pnpm --silent --filter localai_decisions_candle cli benchmark --json
```

`--model` selects another model, as for normal decisions. The default backend is the processor. For Metal, run the following command from this package folder, using the same GPU build requirements as normal decisions:

```bash
cargo run --release --features metal -- benchmark --backend metal
```

The selected backend is used for every case and is never silently replaced by another backend. The short text and long text are fixed in the package so later runs use the same inputs. No dataset download or separate benchmark package is needed.

Peak process resident memory covers model loading, warmup, and measured inference. It is the operating system's high-water mark for this process, not a measurement of separate GPU allocations. MiB means 1,048,576 bytes. Unsupported operating systems omit the memory value. Speed and memory vary with hardware and other running programs.

## Backends and speed

The processor (`--backend cpu`) is the default. On an Apple computer, the graphics chip is much faster. Build with the feature `metal` and select the backend:

```bash
cd packages/experiments/localai_decisions_candle
cargo run --release --features metal -- --backend metal --text "Can I get that charge refunded?" --labels refund_request,other
```

The feature `cuda` selects an NVIDIA graphics card in the same way. It was not tested. A backend that the build does not include gives an error and the tool never switches to another backend by itself.

Time of one decision on one Apple computer, after the model is loaded (the load takes 1 to 5 seconds). The very first Metal run on that computer took 14 seconds more, and the next runs did not:

| Text | Rust, processor | Rust, Metal | Python package gliner2, processor |
| --- | --- | --- | --- |
| 68 tokens | 0.9 seconds | 0.2 seconds | 0.19 seconds |
| 338 tokens | 2.5 seconds | 0.55 seconds | 0.41 seconds |

## Limits

- The text and the tasks together may use at most 512 tokens, the number of positions that the Candle encoder builds. A longer input gives an error that names both numbers. The Python package accepts longer inputs. A text of about 300 words with a few labels fits.
- The model was trained on English. For other languages, the Hugging Face repository has a multilingual model, `fastino/GLiNER2.5-multi-Decide`, but it has another architecture (`boundary`), and this package refuses it with an error. The same is true for `fastino/GLiNER2.5-Decide-1B`, which has a ModernBERT encoder.
- The text is lower-cased and split into words before the model reads it, as in the Python package.
- Few-shot examples in a task are not supported.

## How the results were checked

The package reproduces the Python package gliner2: the layout of the input, the splitting of the words, the DeBERTa v2 encoder, the small network that scores a label, and the choice of the labels. The tests compare the Rust results with the Python results that are saved in `tests/fixtures/python_reference.json`:

- The token identifiers are equal for all 33 examples.
- The largest difference between a logit of Rust and a logit of Python is 0.000012, and the largest difference between two probabilities is 0.0000023.
- The chosen labels are equal for all 33 examples.
- The words are equal to the words of the Python word splitter on 19 difficult texts: web addresses, e-mail addresses, accents, combining marks, Chinese, Hindi, and unusual white space.

The 33 examples are the 21 examples of the model card and 12 more: a text of 338 tokens, French, Chinese, Hindi, a web address, an empty text, labels with spaces, and descriptions of labels. Nine of the 21 examples of the model card show another label than the label that the model really returns, in Python and in Rust. The model card calls those outputs "potential", so the tests do not compare with them.

To add an example, add it to `tests/fixtures/examples.json` and run the script in `python_reference/` again. The first lines of the script show how to install the Python package outside the repository.

## Tests

```bash
pnpm --filter localai_decisions_candle test
```

The tests use a release build, because the model is too slow in a debug build. They need the model in the Hugging Face cache; the first run downloads it. The tests run the real model. They take about one minute, plus the first compilation, which takes a few minutes.
