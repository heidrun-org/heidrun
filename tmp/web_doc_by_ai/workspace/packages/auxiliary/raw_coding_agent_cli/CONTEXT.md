# Directory Context: `/tmp/web_doc_by_ai/workspace/packages/auxiliary/raw_coding_agent_cli`

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
- With the option `isEditAllowed`, `claude` runs with `--permission-mode acceptEdits` and a short list of read-only `git` and `gh issue view` commands, and `codex` runs with `--sandbox workspace-write`. Without it, the coding agent only answers. The option `workingDirectory` sets the folder where the command runs.
- With the option `onProgress`, `claude` runs with `--output-format stream-json --verbose`, the answer is the field `result` of the last event, and each progress line is a remark or a tool name. `codex` sends the lines of its standard error output. The answer never changes.
- The options `model` and `effort` are passed only when they are given: `claude` gets `--model` and `--effort`, and `codex` gets `--model` and `-c model_reasoning_effort="<effort>"`. Without them, each coding agent uses its own settings.
- The library keeps no conversation: one call is one prompt and one answer.
- Nothing in this folder imports from another package of the workspace.
- The application cannot run this library, because the web frontend has no Node.js. The file `packages/apps/desktop_tauri/src/topic_clusters.rs` runs the two commands with the same arguments and the same rules. A change of the default arguments here needs the same change there. The arguments of the option `isEditAllowed` are not used there.

## Background
- The package was created by [issue #113](https://github.com/heidrun-org/heidrun/issues/113). The first user of the library is the script of [issue #114](https://github.com/heidrun-org/heidrun/issues/114).
- `codex exec` refuses to run outside a trusted Git repository without `--skip-git-repo-check`, so the package always passes the flag.
- The options `isEditAllowed` and `workingDirectory` come from [issue #375](https://github.com/heidrun-org/heidrun/issues/375), where a coding agent writes the documentation files.
- [Issue #265](https://github.com/heidrun-org/heidrun/issues/265) is the first use of the two commands inside the application, for the clustered dynamic topics.
