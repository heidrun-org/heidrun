# raw_coding_agent

A small library for [Heidrun](../../README.md). It sends one prompt to a coding agent command line tool (`claude` or `codex`), waits for the answer, and returns the answer as text. The scripts of this repository use it when they need the help of a coding agent. The name `raw_coding_agent` is temporary.

## What it contains

- `src/index.ts`: the public interface. It exports the class `RawCodingAgent` and the types `RawCodingAgentName` and `RawCodingAgentRunOptions`.
- `src/raw_coding_agent.ts`: the code of the class.
- `tests/`: the Vitest tests. They use fake `claude` and `codex` commands.

## Usage

```ts
import { RawCodingAgent } from 'raw_coding_agent';

const answer = await RawCodingAgent.run({
	prompt: 'Write one sentence that explains what a change log is.',
	agentName: 'claude',
});
```

The method `RawCodingAgent.run` takes two options:

| Option | Meaning |
| --- | --- |
| `prompt` | The text to send to the coding agent. |
| `agentName` | `claude` runs `claude -p`. `codex` runs `codex exec --skip-git-repo-check -`. |

The method sends the prompt through the standard input, so a long prompt does not reach the size limit of the command line. The method returns the text that the coding agent prints on the standard output, without the spaces and the line breaks at the start and at the end.

The method throws an error in these cases:

- The command is not installed, or is not in the `PATH`.
- The command exits with an error code. The message of the error contains the standard error output of the command.

## Limits

- Each call is one prompt and one answer. The package keeps no conversation.
- The package does not install `claude` or `codex`. You must install them and sign in before you use the package.

## Commands

Run this command from the root of the repository.

```sh
pnpm --filter raw_coding_agent test   # run the Vitest tests
```
