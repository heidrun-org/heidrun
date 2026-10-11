import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import type { LoggedClick, Recording, Scenario, VideoInfo } from './video_recorder_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	VideoFiles — reads the files of a recording and runs ffprobe and ffmpeg
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The only code that reads the files of a recording and runs the programs `ffprobe` and `ffmpeg`.
 */
export class VideoFiles {
	/**
	 * Reads a scenario file.
	 * @param scenarioPath The path of the scenario file.
	 * @returns The scenario.
	 * @throws An `Error` when the file is not a scenario.
	 */
	static readScenario(scenarioPath: string): Scenario {
		const scenario = JSON.parse(Fs.readFileSync(scenarioPath, 'utf8')) as Scenario;
		if (typeof scenario.name !== 'string' || Array.isArray(scenario.clicks) === false) {
			throw new Error(`The file ${scenarioPath} is not a scenario: it needs a name and a list of clicks.`);
		}
		return scenario;
	}

	/**
	 * Reads the file `recording.json`.
	 * @param recordingPath The path of the file `recording.json`.
	 * @returns The recording.
	 */
	static readRecording(recordingPath: string): Recording {
		return JSON.parse(Fs.readFileSync(recordingPath, 'utf8')) as Recording;
	}

	/**
	 * Reads the clicks written by the click logger.
	 * @param clicksLogPath The path of the file of the click logger: one JSON object on each line.
	 * @returns The clicks, in the order of the file.
	 */
	static readClicksLog(clicksLogPath: string): LoggedClick[] {
		const lines = Fs.readFileSync(clicksLogPath, 'utf8').split('\n');
		return lines
			.filter((line) => {
				return line.trim() !== '';
			})
			.map((line) => {
				return JSON.parse(line) as LoggedClick;
			});
	}

	/**
	 * Measures a video file with `ffprobe`.
	 * @param videoPath The path of the video file.
	 * @returns The size and the length of the video.
	 * @throws An `Error` when `ffprobe` fails.
	 */
	static probe(videoPath: string): VideoInfo {
		const result = ChildProcess.spawnSync(
			'ffprobe',
			[
				'-v',
				'error',
				'-select_streams',
				'v:0',
				'-show_entries',
				'stream=width,height:format=duration',
				'-of',
				'json',
				videoPath,
			],
			{ encoding: 'utf8' },
		);
		if (result.status !== 0) {
			throw new Error(`ffprobe failed on ${videoPath}: ${result.stderr}${result.error?.message ?? ''}`);
		}
		const parsed = JSON.parse(result.stdout) as {
			streams: { width: number; height: number }[];
			format: { duration: string };
		};
		const stream = parsed.streams[0] as { width: number; height: number };
		return {
			widthPixels: stream.width,
			heightPixels: stream.height,
			durationSeconds: Number(parsed.format.duration),
		};
	}

	/**
	 * Cuts a video with `ffmpeg`, and writes it again as H.264 without sound.
	 * @param options.rawVideoPath The path of the raw video.
	 * @param options.cutVideoPath The path of the cut video to write.
	 * @param options.startSeconds The time in the raw video where the cut video starts.
	 * @param options.durationSeconds The length of the cut video.
	 * @returns Nothing.
	 * @throws An `Error` when `ffmpeg` fails.
	 */
	static cut(options: {
		rawVideoPath: string;
		cutVideoPath: string;
		startSeconds: number;
		durationSeconds: number;
	}): void {
		const result = ChildProcess.spawnSync(
			'ffmpeg',
			[
				'-y',
				'-v',
				'error',
				'-ss',
				String(options.startSeconds),
				'-i',
				options.rawVideoPath,
				'-t',
				String(options.durationSeconds),
				'-an',
				'-c:v',
				'libx264',
				'-pix_fmt',
				'yuv420p',
				'-crf',
				'18',
				options.cutVideoPath,
			],
			{ encoding: 'utf8' },
		);
		if (result.status !== 0) {
			throw new Error(`ffmpeg failed: ${result.stderr}${result.error?.message ?? ''}`);
		}
	}

	/**
	 * Gives the path of a file in the folder of the file `recording.json`.
	 * @param recordingPath The path of the file `recording.json`.
	 * @param fileName The name of the file.
	 * @returns The path of the file.
	 */
	static besideRecording(recordingPath: string, fileName: string): string {
		return Path.join(Path.dirname(recordingPath), fileName);
	}
}
