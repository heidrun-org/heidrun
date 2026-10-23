#!/usr/bin/env tsx
// Writes the file public/commits.json from the Git history of a folder.
// pnpm --filter parallax_dino_runner commits:build
import Path from 'node:path';
import { Command } from 'commander';
import { CommitExporter } from './commit_exporter.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Cli — the command line that writes the file commits.json
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The options of the command line, after Commander reads them.
 */
type CliOptions = {
	/** The folder of the Git repository to read. */
	gitFolder: string;
	/** The path of the file commits.json to write. */
	output: string;
};

/**
 * The command line of the package `parallax_dino_runner`: reads the Git history of a folder and writes the file
 * `commits.json` that the page of the game reads.
 */
export class Cli {
	/** The file that the command line writes when the option `--output` is not given. The page reads this file. */
	static readonly DEFAULT_OUTPUT_PATH = Path.join(__dirname, '..', '..', 'public', 'commits.json');

	/**
	 * Parses the command line, writes the file `commits.json`, and prints a report on the standard error output. When
	 * an error happens, prints the message on the standard error output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 */
	static main(argv: string[]): void {
		const program = new Command();
		program
			.name('pnpm --filter parallax_dino_runner commits:build')
			.description(
				'Reads the Git history of a folder, and writes the file commits.json that the page of the game reads. '
					+ 'The command needs no network, and it never changes the Git folder.',
			)
			.option('--git-folder <path>', 'The folder of the Git repository to read.', '.')
			.option('--output <path>', 'The JSON file to write.', Cli.DEFAULT_OUTPUT_PATH)
			.action((cliOptions: CliOptions) => {
				Cli._run(cliOptions);
			});
		program.parse(argv);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Writes the file of commits.
	 * @param cliOptions The options of the command line.
	 */
	private static _run(cliOptions: CliOptions): void {
		try {
			const commitFile = CommitExporter.export(cliOptions.gitFolder, cliOptions.output);
			process.stderr.write(`Wrote ${commitFile.commits.length} commits to ${cliOptions.output}\n`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`${message}\n`);
			process.exitCode = 1;
		}
	}
}

if (process.argv[1] === import.meta.filename) {
	Cli.main(process.argv);
}
