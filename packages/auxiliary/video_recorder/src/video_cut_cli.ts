#!/usr/bin/env tsx
// Cuts a raw video around its clicks and writes clicks.json. pnpm --filter video_recorder video:cut --recording <recording.json> --scenario <file>
import { Command, InvalidArgumentError } from 'commander';
import { VideoCutter } from './video_cutter.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	VideoCutCli — the command line `pnpm --filter video_recorder video:cut`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command line `pnpm --filter video_recorder video:cut`: reads a recording and a scenario, and writes `cut.mp4` and `clicks.json` in the
 * folder of the recording.
 */
export class VideoCutCli {
	/**
	 * Parses the command line and cuts the video. When an error happens, prints the message on the standard error
	 * output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns Nothing.
	 */
	static main(argv: string[]): void {
		const program = new Command();
		program
			.name('pnpm --filter video_recorder video:cut')
			.description(
				'Cuts the raw video from 1 second before the first click to 1.5 seconds after the last click, and '
					+ 'writes cut.mp4 and clicks.json next to recording.json. Needs ffmpeg and ffprobe.',
			)
			.requiredOption('--recording <file>', 'The file recording.json written by `pnpm --filter video_recorder video:record`.')
			.requiredOption('--scenario <file>', 'The scenario file, for example scenarios/issue_211_pin_a_pane.json.')
			.option(
				'--start-delay <seconds>',
				'The time between the start of screencapture and the first frame of the raw video.',
				VideoCutCli._parseSeconds,
				0,
			)
			.parse(argv);
		const options = program.opts<{ recording: string; scenario: string; startDelay: number }>();
		try {
			const clicksFile = VideoCutter.cut({
				recordingPath: options.recording,
				scenarioPath: options.scenario,
				startDelaySeconds: options.startDelay,
			});
			process.stdout.write(
				`Wrote ${VideoCutter.cutVideoFileName} (${clicksFile.video.durationSeconds} seconds) and `
					+ `${VideoCutter.clicksFileName} (${clicksFile.clicks.length} clicks).\n`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}

	/**
	 * Reads the value of the option `--start-delay`.
	 * @param value The text that the user typed.
	 * @returns The number of seconds.
	 * @throws An `InvalidArgumentError` when the text is not a number.
	 */
	private static _parseSeconds(value: string): number {
		const seconds = Number(value);
		if (Number.isFinite(seconds) === false) {
			throw new InvalidArgumentError('Give a number of seconds.');
		}
		return seconds;
	}
}

VideoCutCli.main(process.argv);
