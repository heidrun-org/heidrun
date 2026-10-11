import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ClicksFile } from '../src/video_recorder_types.ts';

const __dirname = import.meta.dirname;

const hasFfmpeg = ChildProcess.spawnSync('ffmpeg', ['-version']).status === 0;

/**
 * Runs the command line `video_cut_cli.ts` in a new process, the same way the pnpm script runs it.
 * @param args The arguments of the command line.
 * @returns The standard output, the standard error output, and the exit code.
 */
function runVideoCut(args: string[]): { stdout: string; stderr: string; exitCode: number | null } {
	const tsxPath = Path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
	const result = ChildProcess.spawnSync(tsxPath, [Path.join(__dirname, '..', 'src', 'video_cut_cli.ts'), ...args], {
		encoding: 'utf8',
	});
	return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}

describe.skipIf(hasFfmpeg === false)('video_cut_cli', () => {
	const temporaryFolders: string[] = [];

	afterEach(() => {
		for (const temporaryFolder of temporaryFolders.splice(0)) {
			Fs.rmSync(temporaryFolder, { recursive: true, force: true });
		}
	});

	/**
	 * Writes a recording folder with a 12 second test video and two clicks, at 4 and 8 seconds.
	 * @returns The folder, and the path of the scenario file.
	 */
	function writeRecordingFolder(): { folder: string; scenarioPath: string } {
		const folder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'video_recorder_test_'));
		temporaryFolders.push(folder);
		const made = ChildProcess.spawnSync('ffmpeg', [
			'-v',
			'error',
			'-f',
			'lavfi',
			'-i',
			'testsrc=size=640x400:rate=10:duration=12',
			'-pix_fmt',
			'yuv420p',
			Path.join(folder, 'raw.mov'),
		]);
		expect(made.status).toBe(0);
		Fs.writeFileSync(
			Path.join(folder, 'recording.json'),
			JSON.stringify({
				startTimeSeconds: 5000,
				window: {
					windowId: 1,
					x: 10,
					y: 20,
					width: 320,
					height: 200,
				},
				rawVideoFileName: 'raw.mov',
				clicksLogFileName: 'clicks_log.jsonl',
			}),
		);
		Fs.writeFileSync(
			Path.join(folder, 'clicks_log.jsonl'),
			'{"timeSeconds":5004,"x":170,"y":120}\n{"timeSeconds":5008,"x":10,"y":20}\n',
		);
		const scenarioPath = Path.join(folder, 'scenario.json');
		Fs.writeFileSync(
			scenarioPath,
			JSON.stringify({
				name: 'test_scenario',
				description: 'Test.',
				clicks: [{ label: 'Middle' }, { label: 'Corner' }],
			}),
		);
		return { folder, scenarioPath };
	}

	it('writes cut.mp4 and clicks.json, with the clicks in the pixels of the video', () => {
		const { folder, scenarioPath } = writeRecordingFolder();
		const result = runVideoCut(['--recording', Path.join(folder, 'recording.json'), '--scenario', scenarioPath]);
		expect(result.exitCode).toBe(0);
		const clicksFile = JSON.parse(Fs.readFileSync(Path.join(folder, 'clicks.json'), 'utf8')) as ClicksFile;
		expect(clicksFile.scenario).toBe('test_scenario');
		expect(clicksFile.video.durationSeconds).toBe(6.5);
		expect(clicksFile.clicks).toEqual([
			{ index: 0, timeSeconds: 1, x: 320, y: 200, label: 'Middle' },
			{ index: 1, timeSeconds: 5, x: 0, y: 0, label: 'Corner' },
		]);
		const probe = ChildProcess.spawnSync(
			'ffprobe',
			['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', Path.join(folder, 'cut.mp4')],
			{ encoding: 'utf8' },
		);
		expect(Math.abs(Number(probe.stdout) - 6.5)).toBeLessThan(0.3);
	});

	it('exits with code 1 when the number of clicks is not the number of clicks of the scenario', () => {
		const { folder, scenarioPath } = writeRecordingFolder();
		Fs.writeFileSync(Path.join(folder, 'clicks_log.jsonl'), '{"timeSeconds":5004,"x":170,"y":120}\n');
		const result = runVideoCut(['--recording', Path.join(folder, 'recording.json'), '--scenario', scenarioPath]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('has 2 clicks');
	});
});
