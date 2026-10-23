# Local AI decisions with Qwen3.5

`localai_decisions_llamacpp` runs the open decision models based on Qwen3.5 on your computer, with llama.cpp, a Rust library, and a command line tool. A decision model reads a text (the "state") and typed questions with their options. It returns a probability for each option, in one pass, and writes no text. The request and the response follow the System One API of TypeSafe, as the endpoint `/v1/systemone` of the server of llama.cpp. After the first download of the model file, the state and the questions never leave your computer.

For example, the state "Customer message: I was charged twice for my order last week and nobody has replied." with the question "Which team should handle this?" and the options `billing`, `shipping`, and `technical` gives `billing` with a probability of 0.79.

## Requirements

- Rust, Cargo, and CMake. The first build compiles llama.cpp, which takes about two minutes.
- Internet access on the first run, to download the model file.
- For the default model: about 1 GB of free disk space and about 3 GB of free memory.

## Supported models

The model is a parameter, `--model`. The default is `ggml-org/Kev-0.8B-GGUF`, file `Q8_0`: the smallest, with the Apache 2.0 license.

| Model | Size of `Q8_0` | Decision type |
| --- | --- | --- |
| `ggml-org/Kev-0.8B-GGUF` | 0.81 GB | `kev` |
| `ggml-org/Kev-4B-GGUF` | 4.48 GB | `kev` |
| `ggml-org/lev-GGUF` | 4.48 GB | `lev` |
| `ggml-org/Kev-9B-GGUF` | 9.53 GB | `kev` |
| `ggml-org/Bespoke-Nimble-9B-v3-GGUF` | 9.53 GB | `nimble` |
| `ggml-org/Clef-Flash-GGUF` | 9.66 GB | `clef` |
| `ggml-org/OpenJev-GGUF` | 28.6 GB | `openjev` |
| `ggml-org/Clef-GGUF` | 28.73 GB | `clef` |

Only Kev-0.8B was run. The code of the other types is copied from the server of llama.cpp, and its prompts use the template of each model file, but it was not run, to avoid the large downloads.

## Take a decision

The short form asks one question. With `--choices`, the question is a choice; without it, a yes or no question:

```bash
pnpm --filter localai_decisions_llamacpp cli --text "I was charged twice for my order." --question "Which team should handle this?" --choices billing,shipping,technical
pnpm --filter localai_decisions_llamacpp cli --text "I was charged twice for my order." --question "Is the customer angry?"
```

A full request is a JSON file or comes from standard input:

```json
{
  "state": "Customer message: I was charged twice for my order last week and nobody has replied.",
  "questions": {
    "route": { "type": "choice", "instructions": "Which team should handle this?", "criteria": { "billing": null, "shipping": null, "technical": null } },
    "angry": { "type": "noul", "instructions": "Is the customer angry?" },
    "urgency": { "type": "score", "instructions": "How urgent is this?", "criteria": ["can wait", "this week", "today", "right now"] }
  }
}
```

```bash
pnpm --filter localai_decisions_llamacpp cli --request request.json
cat request.json | pnpm --filter localai_decisions_llamacpp cli
```

The package command runs inside the package folder, so a relative file path starts there. Use an absolute path for a file elsewhere.

- `state` is a text, an object, or an array.
- Each question has a `type` (`choice`, `score`, or `noul`), `instructions`, and `criteria`: the options of a choice with a description or `null`, 2 to 10 levels of a score, or the optional descriptions of `true` and `false` of a noul.
- The response has `answers`: for a choice, `choice`, `probabilities`, and `confidence`; for a score, `score` (the expected level), `legend`, `probabilities`, and `confidence`; for a noul, `noul` (the probability of yes). `usage.input_tokens` is the number of prompt tokens.

Other options:

- `--model ggml-org/lev-GGUF:Q4_K_M` selects another model and another quantization. A repository `owner/Name-GGUF` with the quantization `Q` gives the file `Name-Q.gguf`. `--model path/to/file.gguf` reads a local file.
- `--check-model-updates` asks Hugging Face for a newer model file. By default, a cached file is used at once.
- `--threads 8` sets the number of processor threads. The default is the number of performance cores, at most 8.
- `--batch-size 4096` sets the largest number of tokens of one prompt (2048 by default). A larger value takes more memory.
- `--output response.json` writes the response in a file, and `--verbose` prints the logs of llama.cpp and the times.

## Use the Rust library

```rust
use localai_decisions_llamacpp::{DecisionConfig, DecisionEngine};
use serde_json::json;

let engine = DecisionEngine::load(DecisionConfig::default())?;
let response = engine.decide(&json!({
    "state": "I was charged twice for my order.",
    "questions": { "route": { "type": "choice", "instructions": "Which team?", "criteria": { "billing": null, "shipping": null } } }
}))?;
println!("{}", response["answers"]["route"]["choice"]);
```

`DecisionEngine::load` reads the model file and takes one or two seconds. Keep the engine and call `decide` for each request.

## GPU

The default build runs on the processor only. A build option adds the GPU, and `--backend gpu` selects it. The existing spelling `--device gpu` works too:

```bash
cd packages/experiments/localai_decisions_llamacpp
GGML_METAL=ON cargo run --release --features metal -- --backend gpu --text "I was charged twice." --question "Which team?" --choices billing,shipping
```

On macOS, llama.cpp builds Metal by default, so the file `.cargo/config.toml` sets `GGML_METAL=OFF` and the Metal build sets `GGML_METAL=ON`. The features `cuda` and `vulkan` select an NVIDIA graphics card or Vulkan in the same way; they were not tested. A GPU in a build without a GPU feature gives an error, and the tool never switches to another device by itself. Changing between the two builds compiles llama.cpp again; use another `CARGO_TARGET_DIR` to keep both.

## Measure speed

Run the reusable benchmark directly through this package's command line:

```bash
pnpm --filter localai_decisions_llamacpp cli benchmark
```

The command measures Choice, Noul (yes or no), and Score (ordered levels), each with a short text and a longer text. Each case completes five measured decisions by default. The model loads once, then each case completes a warmup before timing starts. Model loading and warmup are excluded from the speed measurement. Reading the returned probabilities completes GPU work before the timer starts.

The table shows the input token count, total measured seconds, average seconds per decision, and decisions per second. Every requested decision finishes, even when one decision takes longer than five seconds. Average seconds per decision is total measured time divided by the number of completed decisions; decisions per second is the number of completed decisions divided by total measured time. The JSON also records the requested and completed counts. Qwen token counts include the prompts used for one question, while Candle token counts include the encoded text and labels, so token counts from the two models are not directly comparable.

Useful options:

```bash
pnpm --filter localai_decisions_llamacpp cli benchmark --decisions 10
pnpm --filter localai_decisions_llamacpp cli benchmark --output /tmp/localai_decisions_llamacpp-speed.json
pnpm --silent --filter localai_decisions_llamacpp cli benchmark --json
```

`--model` selects another model, as for normal decisions. The default backend is the processor. `--backend cpu|gpu` is an alias for `--device cpu|gpu`; both spellings work before or after `benchmark`, and for normal decisions. For Metal, run the following command from this package folder, using the same GPU build requirements as normal decisions:

```bash
GGML_METAL=ON cargo run --release --features metal -- benchmark --backend gpu
```

The selected backend is used for every case and is never silently replaced by another backend. The short text and long text are fixed in the package so later runs use the same inputs. No dataset download or separate benchmark package is needed.

Peak process resident memory covers model loading, warmup, and measured inference. It is the operating system's high-water mark for this process, not a measurement of separate GPU allocations. MiB means 1,048,576 bytes. Unsupported operating systems omit the memory value. Speed and memory vary with hardware and other running programs.

## Speed

Time on an Apple M1 Pro with Kev-0.8B, after the model is loaded, while other programs used the processor. The load takes 1.3 to 1.9 seconds on the processor and 0.6 to 0.8 seconds with Metal. The very first Metal run on that computer took 17 seconds more to load, and the next runs did not.

| Request | Processor, 8 threads | Metal |
| --- | --- | --- |
| The README example: 3 questions, 106 prompt tokens | 0.24 to 0.31 seconds | 0.19 to 0.22 seconds |
| A long state: 2 questions, 1523 prompt tokens | 4.1 to 4.3 seconds | 0.9 to 1.1 seconds |

Metal gives answers that differ from the processor by about 0.01, because the GPU computes in another order.

The engine evaluates one prompt at a time. Several prompts in one batch were not faster on the processor, and the recurrent layers of Qwen3.5 then gave other last digits than the server.

## Limits

- The decision type `vllm-d3` is not supported, so these 6 models do not run: `ggml-org/vllm-d3-edge-GGUF`, `ggml-org/vllm-d3-lite-GGUF`, `ggml-org/vllm-d3-nano-GGUF`, `ggml-org/vllm-d3-mini-GGUF`, `ggml-org/vllm-d3-flash-GGUF`, and `ggml-org/vllm-d3-GGUF`. The crate `llama-cpp-sys-2` 0.1.160 builds llama.cpp v0.6.0, which does not have this type yet. They need a newer `llama-cpp-sys-2` and the decision code of that llama.cpp version.
- Text only: the images of OpenJev and Clef (the files `mmproj`) are not supported, and a request with `images` gives an error.
- Laya and Julia-1 are ModernBERT models, not models based on Qwen3.5, and the package refuses them.
- One prompt must fit in the batch size (2048 tokens by default). Clef puts all the questions of a request in one prompt.

## How the results were checked

The package copies the decision code of the server of llama.cpp v0.6.0 (`tools/server/server-decision.cpp`): the prompt from the `systemone` template of the model file, the tokens, the values that the model reads, the temperatures, and the formulas of the confidence. It uses the same llama.cpp version as that server, through `llama-cpp-sys-2`.

The tests compare the package with that server, with Kev-0.8B, on the 8 requests of `tests/fixtures/requests.json`: the README example, an object state, special tokens in the text, 10 levels, French, chat messages, a state of 1523 tokens, and 12 options. The number of prompt tokens is equal, and the largest difference between two probabilities is 0.0000000000000004. The answers of the server are in `tests/fixtures/server_reference.json`, and the script in `server_reference/` writes them again.

The server of llama.cpp 0.7.0 (for example from Homebrew) gives answers that differ by about 0.01, because its computing code is newer.

## Tests

```bash
pnpm --filter localai_decisions_llamacpp test
```

The tests use a release build, because the model is too slow in a debug build. They need Kev-0.8B in the Hugging Face cache; the first run downloads it (0.81 GB). The command `pnpm test` at the root does not run these tests.
