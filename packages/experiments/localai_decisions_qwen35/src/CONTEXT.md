# Directory Context: `/packages/experiments/localai_decisions_qwen35/src`

## Purpose
This folder holds the decision library and the command line tool.

## Key Exports & Entry Points
- `lib.rs`: the public library interface: `DecisionEngine` (`load`, `decide` with a request of the System One API), `DecisionConfig`, `Device`, `resolve_model_file`, `DEFAULT_MODEL`.
- `decision.rs`: the decision code of the server of llama.cpp v0.6.0 written again in Rust: the setup from the metadata, the questions, the prompts, and the answers.
- `template.rs`: the `systemone` template rendered with minijinja and the `tojson` filter of llama.cpp.
- `llama.rs`: the small safe layer over the C functions of `llama-cpp-sys-2`.
- `clef_decision_order.cpp`: the C name of the one llama.cpp function that Clef needs and that has a C++ name only.
- `main.rs`: the command line tool, which reads a request from a file, from standard input, or from the short form, and writes JSON.

## Rules
- `decision.rs` follows `tools/server/server-decision.cpp` of llama.cpp v0.6.0 function by function, in the same order, so that a change of llama.cpp is easy to copy.
- Only `llama.rs` calls the C functions of llama.cpp; the other files use its safe types.
- The engine evaluates one prompt at a time: several prompts in one batch were not faster, and the recurrent layers of Qwen3.5 then change the last digits.
- The package does not use the crate `llama-cpp-2`, because it hides the raw context that the extended batch needs.

## Background
- The decision code that `decision.rs` copies: [server-decision.cpp at v0.6.0](https://github.com/ggml-org/llama.cpp/blob/v0.6.0/tools/server/server-decision.cpp).
- The measures behind the one prompt at a time rule are in the section "Speed" of the README of the package.
