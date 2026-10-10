# Directory Context: `/packages/raw_coding_agent`

## Purpose
Sends one prompt to a coding agent command line tool (`claude` or `codex`), waits for the answer, and returns the answer as text. The scripts of this repository use the package when they need the help of a coding agent. The name `raw_coding_agent` is temporary.

## Key Exports & Entry Points
- `src/index.ts`: the only public interface. It exports the class `RawCodingAgent` and the types `RawCodingAgentName` and `RawCodingAgentRunOptions`.
- `tests/`: the Vitest tests, which use fake `claude` and `codex` commands put at the start of the PATH.
- Command to test this folder: `pnpm --filter raw_coding_agent test`

## Rules
- `claude` runs as `claude -p`, and `codex` runs as `codex exec --skip-git-repo-check -`.
- The prompt always goes through the standard input, never through an argument, so a long prompt does not reach the size limit of the command line.
- The class keeps no conversation: one call is one prompt and one answer.
- Nothing in this folder imports from another package of the workspace.

## Background
- The package was created by [issue #113](https://github.com/heidrun-org/heidrun/issues/113). The first user is the script of [issue #114](https://github.com/heidrun-org/heidrun/issues/114).
- `codex exec` refuses to run outside a trusted Git repository without `--skip-git-repo-check`, so the package always passes the flag.
