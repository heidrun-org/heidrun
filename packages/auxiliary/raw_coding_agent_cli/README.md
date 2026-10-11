# raw_coding_agent_cli

A library and a command line tool for [Heidrun](../../../README.md). Both send one prompt to a coding agent command line tool (`codex` or `claude`), wait for the answer, and return the answer as text. The scripts of this repository use the library when they need the help of a coding agent. The name `raw_coding_agent_cli` is the name of the package and the name of the executable.

## What it contains

- `src/index.ts`: the public interface of the library. It exports the class `RawCodingAgent` and the types `RawCodingAgentName` and `RawCodingAgentRunOptions`.
- `src/library/raw_coding_agent.ts`: the code of the class `RawCodingAgent`.
- `src/cli.ts`: the command line. It is the executable `raw_coding_agent_cli`.
- `tests/`: the Vitest tests. They use fake `codex` and `claude` commands.

## Command line

Run the command from the root of the repository. The option `--silent` of `pnpm` removes the lines that `pnpm` prints before the answer.

```sh
pnpm --silent --filter raw_coding_agent_cli cli "Write one sentence that explains a change log."
pnpm --silent --filter raw_coding_agent_cli cli --agent claude "Write one sentence about Git."
pnpm --silent --filter raw_coding_agent_cli cli --prompt-file prompt.md
git log --oneline -20 | pnpm --silent --filter raw_coding_agent_cli cli "Summarize these commits:"
```

You can also run the file directly: `tsx packages/auxiliary/raw_coding_agent_cli/src/cli.ts --help`.

```text
Usage: raw_coding_agent_cli [options] [prompt]

Sends one prompt to a coding agent (codex or claude), waits for the answer, and
prints the answer on the standard output.

Arguments:
  prompt                    A short prompt, written directly on the command
                            line. Put it in quotes. If the standard input has
                            text, the command adds it after the prompt, with a
                            blank line between them.

Options:
  -a, --agent <name>        The coding agent to run: "codex" runs "codex exec",
                            "claude" runs "claude -p". (choices: "codex",
                            "claude", default: "codex")
  -f, --prompt-file <path>  Read a long prompt from a file, in place of the
                            argument.
  -v, --version             Print the version number.
  -h, --help                Print this help.

Exit codes:
  0   The coding agent answered. The answer is on the standard output.
  1   An error happened. The message is on the standard error output.
```

- The default coding agent is `codex`.
- You give the prompt as an argument or with `--prompt-file`, not both. If you give both, the command exits with code 1.
- If the standard input has text, the command adds the text after the prompt, with a blank line between them. If you give no prompt and the standard input is empty, the command exits with code 1.

## Library

```ts
import { RawCodingAgent } from 'raw_coding_agent_cli';

const answer = await RawCodingAgent.run({
	prompt: 'Write one sentence that explains a change log.',
	agentName: 'codex',
});
```

The method `RawCodingAgent.run` takes two options. The library has no default for the coding agent: you always give `agentName`.

| Option | Meaning |
| --- | --- |
| `prompt` | The text to send to the coding agent. |
| `agentName` | `codex` runs `codex exec --skip-git-repo-check -`. `claude` runs `claude -p`. |

The method sends the prompt through the standard input, so a long prompt does not reach the size limit of the command line. The method returns the text that the coding agent prints on the standard output, without the spaces and the line breaks at the start and at the end.

The method throws an error in these cases:

- The command is not installed, or is not in the `PATH`.
- The command exits with an error code. The message of the error contains the standard error output of the command.

## Limits

- Each call is one prompt and one answer. The package keeps no conversation.
- The package does not install `codex` or `claude`. You must install them and sign in before you use the package.

## Commands

Run this command from the root of the repository.

```sh
pnpm --filter raw_coding_agent_cli test   # run the Vitest tests
```
