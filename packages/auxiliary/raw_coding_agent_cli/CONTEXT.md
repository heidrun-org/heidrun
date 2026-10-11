# Directory Context: `/packages/auxiliary/raw_coding_agent_cli`

## Purpose
A library and a command line tool that send one prompt to a coding agent command line tool (`codex` or `claude`), wait for the answer, and return the answer as text. The scripts of this repository use the library when they need the help of a coding agent. The name `raw_coding_agent_cli` is the name of the package and the name of the executable.

## Key Exports & Entry Points
- `src/index.ts`: the only public interface of the library. It exports the class `RawCodingAgent` and the types `RawCodingAgentName` and `RawCodingAgentRunOptions`. It does not export the command line.
- `src/library/`: the code of the class `RawCodingAgent` — see its own CONTEXT.md.
- `src/cli.ts`: the command line, and the executable `raw_coding_agent_cli` of the `bin` entry in `package.json`.
- `tests/`: the Vitest tests, which use fake `codex` and `claude` commands put at the start of the PATH.
- Command to run this folder: `pnpm --silent --filter raw_coding_agent_cli cli --help`
- Command to test this folder: `pnpm --filter raw_coding_agent_cli test`

## Rules
- `claude` runs as `claude -p`, and `codex` runs as `codex exec --skip-git-repo-check -`.
- The prompt always goes through the standard input of the coding agent, never through an argument, so a long prompt does not reach the size limit of the command line.
- The command line uses `codex` when the option `--agent` is missing. The library has no default: the caller always gives `agentName`.
- The command line prints the answer on the standard output, prints an error message on the standard error output, and exits with code 1 when an error happens.
- The library keeps no conversation: one call is one prompt and one answer.
- Nothing in this folder imports from another package of the workspace.

## Background
- The package was created by [issue #113](https://github.com/heidrun-org/heidrun/issues/113). The first user of the library is the script of [issue #114](https://github.com/heidrun-org/heidrun/issues/114).
- `codex exec` refuses to run outside a trusted Git repository without `--skip-git-repo-check`, so the package always passes the flag.
