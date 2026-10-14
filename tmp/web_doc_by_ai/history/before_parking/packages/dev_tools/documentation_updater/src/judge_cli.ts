#!/usr/bin/env tsx
// Scores the quality of the generated user documentation of the website with a coding agent.
// pnpm docs:judge_by_ai
import { ChangeLogGit } from 'change_log_generator';
import { Command } from 'commander';
import { DocumentationJudge } from './documentation_judge.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	JudgeCli — the command line `pnpm docs:judge_by_ai`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command line `pnpm docs:judge_by_ai`: reads the options, runs `DocumentationJudge`, and prints the report.
 */
export class JudgeCli {
	/**
	 * Parses the command line and judges the pages. When an error happens, prints the message on the standard error
	 * output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns A promise that resolves when the command has finished.
	 */
	static async main(argv: string[]): Promise<void> {
		const program = new Command();
		program
			.name('pnpm docs:judge_by_ai')
			.description(
				'Scores the generated pages of the user documentation of the website. Each page gets mechanical '
					+ 'measures (length, longest paragraph, lists, tables), then a coding agent scores it from 1 to 5 '
					+ 'on six criteria (task success, usefulness, order, single page type, user language, accuracy) and '
					+ 'lists its worst problems. The command reads the pages of the working tree and edits no file.',
			)
			.option(
				'--agent <name>',
				`The coding agent that judges: "claude" or "codex". (default: "${DocumentationJudge.defaultAgentName}", `
					+ 'so the judge differs from the default writer "codex")',
			)
			.option('--model <name>', 'The model of the coding agent. (Claude default: claude-sonnet-5-5; other agents: their settings)')
			.option('--effort <level>', 'The effort level of the coding agent. (Claude default: high; other agents: their settings)')
			.option('--only <file...>', 'Judge only these pages, by file name, for example copy_a_file_path.md.')
			.option('--json', 'Print the judgement as JSON, for a script, in place of the Markdown report.')
			.option('--verbose', 'Show what the coding agent does while it works.')
			.option('--dry-run', 'Print the prompt of the judge, with the pages and their measures, and stop.')
			.addHelpText(
				'after',
				`
Examples:
  $ pnpm docs:judge_by_ai                                  judge all the generated pages
  $ pnpm docs:judge_by_ai --only copy_a_file_path.md       judge one page
  $ pnpm docs:judge_by_ai --json > judgement.json          keep the scores for a comparison
`,
			);
		program.parse(argv);
		const options = program.opts<{
			agent?: string;
			model?: string;
			effort?: string;
			only?: string[];
			json?: boolean;
			verbose?: boolean;
			dryRun?: boolean;
		}>();
		try {
			const result = await DocumentationJudge.run({
				repositoryPath: ChangeLogGit.findRepositoryPath(process.cwd()),
				agentName: options.agent ?? DocumentationJudge.defaultAgentName,
				model: options.model,
				effort: options.effort,
				onlyPageFiles: options.only ?? [],
				isDryRun: options.dryRun === true,
				onStep: (message: string) => {
					process.stderr.write(`${message}\n`);
				},
				onAgentProgress: options.verbose === true
					? (message: string) => {
						process.stderr.write(`  | ${message}\n`);
					}
					: undefined,
			});
			if (result.judgement === null) {
				process.stdout.write(`${result.prompt}\n`);
				return;
			}
			if (options.json === true) {
				process.stdout.write(`${JSON.stringify(result.judgement, null, 2)}\n`);
				return;
			}
			process.stdout.write(`${DocumentationJudge.renderReport(result.judgement)}\n`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}
}

JudgeCli.main(process.argv);
