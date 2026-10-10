#!/usr/bin/env tsx
import Fs from 'node:fs';
import Path from 'node:path';
import { Command, Option } from 'commander';
import { RawCodingAgent } from './raw_coding_agent.ts';
import type { RawCodingAgentName } from './raw_coding_agent.ts';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Cli — the command line of the package: sends one prompt to a coding agent and prints the answer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The options that the command line parser reads.
 */
type CliOptions = {
	/** The coding agent to run. */
	agent: RawCodingAgentName;
	/** The path of a file that holds the prompt, or undefined when the option is not given. */
	promptFile?: string;
};

/**
 * The command line of the package `raw_coding_agent_cli`.
 */
export class Cli {
	/**
	 * Parses the command line, runs the coding agent, and prints the answer on the standard output. When an error
	 * happens, prints the message on the standard error output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns A promise that resolves when the command has finished.
	 */
	static async main(argv: string[]): Promise<void> {
		const program = Cli._buildProgram();
		program.parse(argv);
		const options = program.opts<CliOptions>();
		const promptArgument: string | undefined = program.args[0];
		try {
			const stdinText = await Cli._readStandardInput();
			const prompt = Cli._resolvePrompt({
				promptArgument,
				promptFilePath: options.promptFile,
				stdinText,
			});
			const answer = await RawCodingAgent.run({
				prompt,
				agentName: options.agent,
			});
			process.stdout.write(`${answer}\n`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Builds the command line parser, with the arguments, the options, the version, and the help text.
	 * @returns The command line parser.
	 */
	private static _buildProgram(): Command {
		const program = new Command();
		program
			.name('raw_coding_agent_cli')
			.description(
				'Sends one prompt to a coding agent (codex or claude), waits for the answer, and prints the answer '
					+ 'on the standard output.',
			)
			.argument(
				'[prompt]',
				'A short prompt, written directly on the command line. Put it in quotes. If the standard input has '
					+ 'text, the command adds it after the prompt, with a blank line between them.',
			)
			.addOption(
				new Option(
					'-a, --agent <name>',
					'The coding agent to run: "codex" runs "codex exec", "claude" runs "claude -p".',
				)
					.choices(RawCodingAgent.agentNames)
					.default('codex'),
			)
			.option('-f, --prompt-file <path>', 'Read a long prompt from a file, in place of the argument.')
			.version(Cli._readVersion(), '-v, --version', 'Print the version number.')
			.helpOption('-h, --help', 'Print this help.')
			.addHelpText(
				'after',
				`
Exit codes:
  0   The coding agent answered. The answer is on the standard output.
  1   An error happened. The message is on the standard error output.

Examples:
  $ raw_coding_agent_cli "Write one sentence that explains a change log."
  $ raw_coding_agent_cli --agent claude "Write one sentence about Git."
  $ raw_coding_agent_cli --prompt-file prompt.md
  $ git log --oneline -20 | raw_coding_agent_cli "Summarize these commits:"
`,
			);
		return program;
	}

	/**
	 * Reads the version number from the file `package.json` of the package.
	 * @returns The version number.
	 */
	private static _readVersion(): string {
		const packageJsonPath = Path.join(__dirname, '..', 'package.json');
		const packageJson: unknown = JSON.parse(Fs.readFileSync(packageJsonPath, 'utf8'));
		if (typeof packageJson === 'object' && packageJson !== null && 'version' in packageJson) {
			return String(packageJson.version);
		}
		throw new Error(`The file ${packageJsonPath} has no version.`);
	}

	/**
	 * Reads all the text of the standard input. When the standard input is a terminal, nobody pipes text to the
	 * command, so the method does not wait and returns an empty text.
	 * @returns The text of the standard input, or an empty text.
	 */
	private static async _readStandardInput(): Promise<string> {
		if (process.stdin.isTTY === true) {
			return '';
		}
		const chunks: Buffer[] = [];
		for await (const chunk of process.stdin) {
			chunks.push(Buffer.from(chunk));
		}
		return Buffer.concat(chunks).toString('utf8');
	}

	/**
	 * Builds the prompt from the argument or from the file, then adds the text of the standard input after it.
	 * @param options.promptArgument The prompt written on the command line, or undefined.
	 * @param options.promptFilePath The path of the prompt file, or undefined.
	 * @param options.stdinText The text of the standard input, or an empty text.
	 * @returns The prompt to send to the coding agent.
	 * @throws An error when the argument and the file are both given, when the file cannot be read, or when there is
	 * no text at all.
	 */
	private static _resolvePrompt(options: {
		promptArgument: string | undefined;
		promptFilePath: string | undefined;
		stdinText: string;
	}): string {
		if (options.promptArgument !== undefined && options.promptFilePath !== undefined) {
			throw new Error('Give a prompt argument or the option --prompt-file, not both.');
		}
		let mainPrompt = options.promptArgument ?? '';
		if (options.promptFilePath !== undefined) {
			try {
				mainPrompt = Fs.readFileSync(options.promptFilePath, 'utf8');
			} catch {
				throw new Error(`Cannot read the prompt file "${options.promptFilePath}".`);
			}
		}
		const parts = [mainPrompt.trim(), options.stdinText.trim()].filter((part) => {
			return part !== '';
		});
		if (parts.length === 0) {
			throw new Error(
				'No prompt. Give a prompt argument, the option --prompt-file, or text on the standard input.',
			);
		}
		return parts.join('\n\n');
	}
}

Cli.main(process.argv);
