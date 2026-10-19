# Directory Context: `/packages/experiments/localai_decisions_qwen35/server_reference`

## Purpose
This folder holds the Python script that sends the requests of `tests/fixtures/requests.json` to the server of llama.cpp and writes the answers that the Rust tests compare with.

## Key Exports & Entry Points
- `generate_server_reference.py`: writes `tests/fixtures/server_reference.json`.
- Command to run this folder: see the first lines of `generate_server_reference.py`; it needs a `llama-server` of llama.cpp v0.6.0, built outside the repository.

## Rules
- The script runs only to refresh the fixtures; no test and no command of the package starts the server.
- The server is the llama.cpp version that `llama-cpp-sys-2` builds, and the script sends each question alone.
- The script uses only the standard library of Python.

## Background
- The reason to send each question alone is in the first lines of the script.
