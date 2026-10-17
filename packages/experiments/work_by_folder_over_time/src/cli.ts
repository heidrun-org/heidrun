#!/usr/bin/env tsx
// Reads Git activity by folder and writes a self-contained HTML report.
// pnpm experiment:work_by_folder_over_time --workspace-folder <path> --start-time <ISO-8601> --end-time <ISO-8601>
import Fs from 'node:fs';
import Path from 'node:path';
import { Command } from 'commander';
import { FolderActivityBuilder } from './folder_activity_builder.ts';
import { GitActivityReader } from './git_activity_reader.ts';
import { ReportBuilder } from './report_builder.ts';
import { WorkspaceFolderReader } from './workspace_folder_reader.ts';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Cli — writes the folder activity report
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The command line options for generating the folder activity report. */
type CliOptions = {
	/** The workspace folder to read. */
	workspaceFolder: string;
	/** The inclusive start time, with an explicit time zone. */
	startTime: string;
	/** The exclusive end time, with an explicit time zone. */
	endTime: string;
	/** The HTML report output path. */
	output: string;
};

/** Parses the report command line, reads Git, and writes the HTML report. */
export class Cli {
	/** The default location of the generated HTML report. */
	static readonly DEFAULT_OUTPUT_PATH = Path.join(__dirname, '..', 'public', 'report.html');

	/**
	 * Parses command line arguments and runs the report generator.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 */
	static main(argv: string[]): void {
		const program = new Command();
		program
			.name('pnpm --filter work_by_folder_over_time report:build')
			.description('Reads Git activity for a workspace folder and writes a self-contained HTML report.')
			.requiredOption('--workspace-folder <path>', 'The workspace folder to read.')
			.requiredOption('--start-time <ISO-8601>', 'The inclusive start time, with a time zone.')
			.requiredOption('--end-time <ISO-8601>', 'The exclusive end time, with a time zone.')
			.option('--output <path>', 'The HTML report output path.', Cli.DEFAULT_OUTPUT_PATH)
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
	 * Validates the time range, builds the report, and writes it to disk.
	 * @param cliOptions The parsed command line options.
	 */
	private static _run(cliOptions: CliOptions): void {
		try {
			const startTime = Cli._parseTime(cliOptions.startTime, 'start_time');
			const endTime = Cli._parseTime(cliOptions.endTime, 'end_time');
			if (startTime >= endTime) {
				throw new Error('start_time must be earlier than end_time.');
			}
			const gitWorkspace = GitActivityReader.resolveWorkspace(cliOptions.workspaceFolder);
			const commits = GitActivityReader.read(gitWorkspace);
			const workspaceFolders = WorkspaceFolderReader.read(gitWorkspace);
			const reportData = FolderActivityBuilder.build(gitWorkspace, commits, workspaceFolders, startTime, endTime);
			const outputPath = Path.resolve(cliOptions.output);
			Fs.mkdirSync(Path.dirname(outputPath), {
				recursive: true,
			});
			Fs.writeFileSync(outputPath, ReportBuilder.build(reportData), 'utf8');
			const changedLines = reportData.folders.reduce((total, folderActivity) => total + folderActivity.changedLines, 0);
			process.stderr.write(
				`Wrote ${outputPath}: ${reportData.folders.length} folders, ${changedLines} changed lines.\n`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}

	/**
	 * Parses an ISO 8601 timestamp that includes a time zone.
	 * @param value The supplied timestamp.
	 * @param inputName The command line input name for error messages.
	 * @returns The parsed instant.
	 */
	private static _parseTime(value: string, inputName: string): Date {
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value) === false) {
			throw new Error(
				`${inputName} must be an ISO 8601 timestamp with a time zone, `
					+ 'for example 2026-09-01T00:00:00Z.',
			);
		}
		const calendarDateValue = new Date(`${value.slice(0, 10)}T00:00:00Z`);
		if (Number.isNaN(calendarDateValue.getTime()) === true) {
			throw new Error(`${inputName} has an invalid calendar date: ${value}`);
		}
		const calendarDate = calendarDateValue.toISOString().slice(0, 10);
		if (calendarDate !== value.slice(0, 10)) {
			throw new Error(`${inputName} has an invalid calendar date: ${value}`);
		}
		const date = new Date(value);
		if (Number.isNaN(date.getTime()) === true) {
			throw new Error(`${inputName} is not a valid timestamp: ${value}`);
		}
		return date;
	}
}

if (process.argv[1] === __filename) {
	Cli.main(process.argv);
}
