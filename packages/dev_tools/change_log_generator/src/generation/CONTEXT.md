# Directory Context: `/packages/dev_tools/change_log_generator/src/generation`

## Purpose
Runs the whole generation: resolves the range, reads the pull requests, writes the section in the mechanical mode or with a coding agent, and updates the file `CHANGELOG.md`.

## Key Exports & Entry Points
- `generate_change_log.ts`: the class `GenerateChangeLog`, with the method `run`, and the types `GenerateChangeLogRunOptions` and `RunAgentFn`.

## Rules
- This folder uses `git/` to read, and `rendering/` to write the texts.
- Only this folder runs the executable of the package `raw_coding_agent_cli`, with `cargo run`, and only when the option `--ai` is used.
- Nothing here imports from `src/cli.ts`.

## Background
- The folder was created by [issue #114](https://github.com/heidrun-org/heidrun/issues/114). The coding agent comes from [issue #113](https://github.com/heidrun-org/heidrun/issues/113).
