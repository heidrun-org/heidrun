#!/usr/bin/env tsx
// Updates the user documentation of the website with a coding agent, from the last documented commit to the current commit.
// pnpm docs:update_by_ai
import { ChangeLogGit } from 'change_log_generator';
import { Command } from 'commander';
import { DocumentationUpdate } from './documentation_update.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Cli — the command line `pnpm docs:update_by_ai`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command line `pnpm docs:update_by_ai`: reads the options, runs `DocumentationUpdate`, and prints the result.
 */
export class Cli {
	/**
	 * Parses the command line and updates the documentation. When an error happens, prints the message on the standard
	 * error output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns A promise that resolves when the command has finished.
	 */
	static async main(argv: string[]): Promise<void> {
		const program = new Command();
		program
			.name('pnpm docs:update_by_ai')
			.description(
				'Updates the user documentation of the website with a coding agent. Every run is a full check: the '
					+ 'coding agent compares all the documentation with all the current rules and code. The commits '
					+ 'since the last documented commit (the file .last_documented_commit) only say which sections to '
					+ 'look at first. Then the command runs the tests and the build of the website and leaves the '
					+ 'generated files uncommitted. Git history is read only; branches, commits, pushes, and pull '
					+ 'requests are handled by the developer outside this command. Existing local changes are allowed.',
			)
			.option(
				'--agent <name>',
				`The coding agent: "claude" or "codex". (default: "${DocumentationUpdate.defaultAgentName}")`,
			)
			.option(
				'--model <name>',
				'The model of the coding agent, for example "gpt-5-codex" for codex or "opus" for claude. (default: the '
					+ 'model of the settings of the coding agent)',
			)
			.option(
				'--effort <level>',
				'The effort level of the coding agent, for example "low", "medium", or "high". (default: the effort of '
					+ 'the settings of the coding agent)',
			)
			.option(
				'--only <path...>',
				'Limit the run to the features of these rule files (paths relative to the root of the repository). '
					+ 'The run is then not a full check, so the file .last_documented_commit is not written. Use it '
					+ 'for a small trial.',
			)
			.option(
				'--verbose',
				'Show what the coding agent does while it works: the files it reads and writes, and its remarks.',
			)
			.option(
				'--dry-run',
				'Print the prompt, with the hints, and stop. Nothing is changed and no coding agent runs.',
			)
			.addHelpText(
				'after',
				`
Examples:
  $ pnpm docs:update_by_ai                        generate and check pages, leave files uncommitted
  $ pnpm docs:update_by_ai --dry-run              print the prompt only
  $ pnpm docs:update_by_ai --verbose              show what the coding agent does
  $ pnpm docs:update_by_ai --effort high          think longer
  $ pnpm docs:update_by_ai --only docs/agents_rules/user_interface/sidebars/files.md
`,
			);
		program.parse(argv);
		const options = program.opts<{
			agent?: string;
			model?: string;
			effort?: string;
			dryRun?: boolean;
			only?: string[];
			verbose?: boolean;
		}>();
		try {
			const result = await DocumentationUpdate.run({
				repositoryPath: ChangeLogGit.findRepositoryPath(process.cwd()),
				agentName: options.agent ?? DocumentationUpdate.defaultAgentName,
				model: options.model,
				effort: options.effort,
				isDryRun: options.dryRun === true,
				onlyRuleFiles: options.only ?? [],
				onStep: (message: string) => {
					process.stderr.write(`${message}\n`);
				},
				onAgentProgress: options.verbose === true
					? (message: string) => {
						process.stderr.write(`  | ${message}\n`);
					}
					: undefined,
			});
			process.stdout.write(`${result.report}\n`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}
}

Cli.main(process.argv);
