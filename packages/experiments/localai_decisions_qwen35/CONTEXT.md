# Directory Context: `/packages/experiments/localai_decisions_qwen35`

## Purpose
This package runs the decision models based on Qwen3.5 on the computer, with llama.cpp, a Rust library, and a command line tool. A decision model reads a text (the state) and typed questions, and returns a probability for each option, as the System One API of the server of llama.cpp (`/v1/systemone`).

## Key Exports & Entry Points
- `src/`: the Rust library and the command line tool. See its own CONTEXT.md.
- `tests/`: the Rust tests, and the answers of the server of llama.cpp that they compare with. See its own CONTEXT.md.
- `server_reference/`: the script that writes the answers of the server. See its own CONTEXT.md.
- `README.md`: installation, use, the supported models, and the limits.
- Command to run this folder: `pnpm --filter localai_decisions_qwen35 cli --text "<state>" --question "<question>" --choices <option>,<option>`
- Command to test this folder: `pnpm --filter localai_decisions_qwen35 test`

## Rules
- The model runs on the computer and the package never sends the state or the questions to a hosted inference service.
- The default build runs on the processor only: `.cargo/config.toml` sets `GGML_METAL=OFF`, and a GPU build needs a feature (`metal`, `cuda`, or `vulkan`); the feature `metal` also needs `GGML_METAL=ON`.
- The version of `llama-cpp-sys-2` is pinned, because `src/decision.rs` copies the decision code of the llama.cpp version that it builds (v0.6.0); a new version needs the new decision code and new server answers.
- The package supports the decision types openjev, lev, kev, nimble, and clef, and refuses every other type with an error that names it.
- Cached model files are used at once by default; `--check-model-updates` asks Hugging Face for a newer file.
- The package depends on no other package of this repository, and no package outside `packages/experiments` imports it.

## Background
- The package comes from [issue #721](https://github.com/heidrun-org/heidrun/issues/721); its first test proved that the Rust binding gives the same values as the server of llama.cpp of the same version.
- The decision type vllm-d3 is missing because llama.cpp v0.6.0 does not have it; see the README.
