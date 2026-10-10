# Directory Context: `/packages/auxiliary/raw_coding_agent_cli/src/library`

## Purpose
The library code of the package: the class that runs `codex` or `claude` with one prompt and returns the answer as text.

## Key Exports & Entry Points
- `raw_coding_agent.ts`: the class `RawCodingAgent` and the types `RawCodingAgentName` and `RawCodingAgentRunOptions`. Other code imports them through `src/index.ts`, not from this folder.

## Rules
- Nothing here imports from `src/cli.ts`: the command line depends on the library, and the library does not depend on the command line.
- The prompt always goes through the standard input of the coding agent, never through an argument.

## Background
- The folder exists to keep the library apart from the command line `src/cli.ts`, as asked in [issue #113](https://github.com/heidrun-org/heidrun/issues/113).
