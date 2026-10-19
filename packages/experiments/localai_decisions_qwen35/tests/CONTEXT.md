# Directory Context: `/packages/experiments/localai_decisions_qwen35/tests`

## Purpose
This folder holds the Rust tests of the package, and the answers of the server of llama.cpp that the tests compare with.

## Key Exports & Entry Points
- `server_reference.rs`: compares the answers and the number of prompt tokens with the answers of the server, on the requests of `fixtures/requests.json`.
- `requests_and_errors.rs`: the errors of a request, the batch size, the refused GPU, and the model names.
- `benchmark_command.rs`: benchmark discovery, help, decision-count, device validation, and the backend alias without loading weights.
- `command_line.rs`: runs the compiled command line tool.
- `fixtures/`: `requests.json` (the requests) and `server_reference.json` (the answers of the server).
- Command to run this folder: `pnpm --filter localai_decisions_qwen35 test`

## Rules
- The tests need the model ggml-org/Kev-0.8B-GGUF (file `Q8_0`) in the Hugging Face cache, and the first run downloads it (0.81 GB).
- Never edit `server_reference.json` by hand; run the script in `server_reference/`.
- A new request goes into `requests.json`, then the script writes its server answers.

## Background
- The tolerance of the comparison is in `server_reference.rs`; the measured largest difference is in the README of the package.
