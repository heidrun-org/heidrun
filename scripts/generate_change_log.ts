// Generates the section "Unreleased" of CHANGELOG.md from the pull requests merged after the last release.
// pnpm release:change_log
import Fs from 'node:fs';
import Path from 'node:path';
import { Command } from 'commander';
import type { RawCodingAgentName } from 'raw_coding_agent_cli';
import { ChangeLogGit } from './change_log/change_log_git.ts';
import { ChangeLogRenderer } from './change_log/change_log_renderer.ts';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GenerateChangeLog — writes the file CHANGELOG.md in the Keep a Changelog format
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Runs a coding agent: gives it a prompt and returns its answer.
 * @param prompt The prompt to send.
 * @param agentName The name of the coding agent, `codex` or `claude`.
 * @returns The answer of the coding agent.
 */
export type RunAgentFn = (prompt: string, agentName: string) => Promise<string>;

/**
 * The options of the method `GenerateChangeLog.run`.
 */
export type GenerateChangeLogRunOptions = {
	/** The root folder of the Git repository. The file `CHANGELOG.md` is in this folder. */
	repositoryPath: string;
	/** When true, a coding agent writes the section. When false, the script writes the section mechanically. */
	isAi: boolean;
	/** The name of the coding agent, or undefined for the default one. Only allowed when `isAi` is true. */
	agentName: string | undefined;
	/** Runs the coding agent. When undefined, the package `raw_coding_agent_cli` runs it. */
	runAgentFn?: RunAgentFn;
};

/**
 * Writes the section "Unreleased" of the file `CHANGELOG.md`, in the Keep a Changelog format, from the pull requests
 * that were merged after the last release.
 */
export class GenerateChangeLog {
	/** The coding agent that the option `--ai` uses when the option `--agent` is missing. */
	static readonly defaultAgentName = 'codex';

	/** The name of the file that the script writes, in the root folder of the Git repository. */
	static readonly changeLogFileName = 'CHANGELOG.md';

	/**
	 * Parses the command line, writes the file `CHANGELOG.md`, and prints the new section on the standard output.
	 * When an error happens, prints the message on the standard error output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns A promise that resolves when the script has finished.
	 */
	static async main(argv: string[]): Promise<void> {
		const program = new Command();
		program
			.name('pnpm release:change_log')
			.description(
				'Writes the section "Unreleased" of CHANGELOG.md, in the Keep a Changelog format, from the pull requests '
					+ 'merged after the last release (the tag with the highest version). The new section goes at the top '
					+ 'of the file, and replaces an existing section "Unreleased". The older sections do not change. '
					+ 'The command prints the new section on the standard output.',
			)
			.option(
				'--ai',
				'Ask a coding agent to write the section, with the categories Added, Changed, Deprecated, Removed, '
					+ 'Fixed, and Security. Without this option, the section is a plain list of the pull requests.',
			)
			.option(
				'--agent <name>',
				`The coding agent for the option --ai: "codex" or "claude". (default: "${GenerateChangeLog.defaultAgentName}")`,
			);
		program.parse(argv);
		const options = program.opts<{ ai?: boolean; agent?: string }>();
		try {
			const repositoryPath = ChangeLogGit.findRepositoryPath(process.cwd());
			const section = await GenerateChangeLog.run({
				repositoryPath,
				isAi: options.ai === true,
				agentName: options.agent,
			});
			process.stderr.write(`Wrote ${Path.join(repositoryPath, GenerateChangeLog.changeLogFileName)}\n`);
			process.stdout.write(`${section}\n`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}

	/**
	 * Finds the merged pull requests, writes the new section, and puts it in the file `CHANGELOG.md`. The method
	 * creates the file when it does not exist.
	 * @param options The folder of the repository, and the choice of the mode.
	 * @returns The new section, in Markdown.
	 * @throws An error when `agentName` is given without `isAi`, or when the coding agent fails.
	 */
	static async run(options: GenerateChangeLogRunOptions): Promise<string> {
		if (options.isAi === false && options.agentName !== undefined) {
			throw new Error('The option --agent needs the option --ai.');
		}
		const lastTag = ChangeLogGit.findLastTag(options.repositoryPath);
		const mergedPullRequests = ChangeLogGit.listMergedPullRequests(options.repositoryPath, lastTag);
		const repositoryUrl = ChangeLogGit.findRepositoryUrl(options.repositoryPath);
		let section: string;
		if (options.isAi === true) {
			const runAgentFn = options.runAgentFn ?? GenerateChangeLog._runRawCodingAgent;
			const prompt = ChangeLogRenderer.buildPrompt(mergedPullRequests, repositoryUrl, lastTag);
			const answer = await runAgentFn(prompt, options.agentName ?? GenerateChangeLog.defaultAgentName);
			section = ChangeLogRenderer.cleanAgentAnswer(answer);
		} else {
			section = ChangeLogRenderer.renderMechanicalSection(mergedPullRequests, repositoryUrl, lastTag);
		}
		const changeLogPath = Path.join(options.repositoryPath, GenerateChangeLog.changeLogFileName);
		const existingText = Fs.existsSync(changeLogPath) ? Fs.readFileSync(changeLogPath, 'utf8') : null;
		Fs.writeFileSync(changeLogPath, ChangeLogRenderer.insertSection(existingText, section));
		return section;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Runs a coding agent with the package `raw_coding_agent_cli`. The package is loaded only here, so the mode without
	 * the option `--ai` does not need it.
	 * @param prompt The prompt to send.
	 * @param agentName The name of the coding agent, `codex` or `claude`.
	 * @returns The answer of the coding agent.
	 * @throws An error when the name is not the name of a known coding agent.
	 */
	private static async _runRawCodingAgent(prompt: string, agentName: string): Promise<string> {
		const { RawCodingAgent } = await import('raw_coding_agent_cli');
		const knownAgentName: RawCodingAgentName | undefined = RawCodingAgent.agentNames.find((name) => {
			return name === agentName;
		});
		if (knownAgentName === undefined) {
			throw new Error(`Unknown coding agent "${agentName}". Use ${RawCodingAgent.agentNames.join(' or ')}.`);
		}
		return RawCodingAgent.run({
			prompt,
			agentName: knownAgentName,
		});
	}
}

if (process.argv[1] !== undefined && Path.resolve(process.argv[1]) === __filename) {
	GenerateChangeLog.main(process.argv);
}
