#!/usr/bin/env tsx
// Lists, and with --yes deletes, the Cargo target folders of the worktrees that no build has used for some days.
// pnpm --filter desktop_tauri target:clean
import { Command, InvalidArgumentError } from 'commander';
import { TargetClean } from './target_clean.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TargetCleanCli — the command line `pnpm --filter desktop_tauri target:clean`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command line `pnpm --filter desktop_tauri target:clean`: reads the options, runs `TargetClean`, and prints the
 * stale target folders.
 */
export class TargetCleanCli {
	/**
	 * Parses the command line, lists the stale target folders, and deletes them when the option `--yes` is present.
	 * When an error happens, prints the message on the standard error output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns Nothing.
	 */
	static main(argv: string[]): void {
		const program = new Command();
		program
			.name('pnpm --filter desktop_tauri target:clean')
			.description(
				'Finds the Cargo target folders of the worktrees that no build has used for some days. Without '
					+ '--yes, it only lists them. With --yes, it deletes them. It never touches the main checkout. It '
					+ 'does not show the size of the folders, because a cloned folder shares its disk blocks with the '
					+ 'main checkout, so the command du shows a size that is too high.',
			)
			.option(
				'--days <number>',
				'The number of days without a build after which a target folder is stale.',
				TargetCleanCli._parseDays,
				TargetClean.defaultMinimumAgeInDays,
			)
			.option('--yes', 'Delete the stale target folders. Without this option, the command only lists them.')
			.parse(argv);
		const options = program.opts<{ days: number; yes?: boolean }>();
		try {
			const staleTargetFolders = TargetClean.findStale({
				workingDirectory: process.cwd(),
				minimumAgeInDays: options.days,
				now: new Date(),
			});
			if (staleTargetFolders.length === 0) {
				process.stdout.write(`No worktree has a target folder that is ${options.days} days old or older.\n`);
				return;
			}
			for (const staleTargetFolder of staleTargetFolders) {
				process.stdout.write(
					`${staleTargetFolder.targetPath} — last used ${staleTargetFolder.ageInDays} days ago\n`,
				);
			}
			if (options.yes === true) {
				TargetClean.remove(staleTargetFolders);
				process.stdout.write(`Deleted ${staleTargetFolders.length} target folders.\n`);
			} else {
				process.stdout.write(
					`Nothing was deleted. Run the command again with --yes to delete these `
						+ `${staleTargetFolders.length} target folders.\n`,
				);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}

	/**
	 * Reads the value of the option `--days`.
	 * @param value The text that the user typed.
	 * @returns The number of days.
	 * @throws An `InvalidArgumentError` when the text is not a whole number of days, zero or more.
	 */
	private static _parseDays(value: string): number {
		const days = Number(value);
		if (Number.isInteger(days) === false || days < 0) {
			throw new InvalidArgumentError('Give a whole number of days, zero or more.');
		}
		return days;
	}
}

TargetCleanCli.main(process.argv);
