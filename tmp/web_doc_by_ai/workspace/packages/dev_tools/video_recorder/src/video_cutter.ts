import Fs from 'node:fs';
import { ClicksBuilder } from './clicks_builder.ts';
import { VideoFiles } from './video_files.ts';
import type { ClicksFile } from './video_recorder_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	VideoCutter — cuts a raw video around its clicks and writes clicks.json
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Cuts the raw video from 1 second before the first click to 1.5 seconds after the last click, and writes the file
 * `clicks.json` next to the cut video.
 */
export class VideoCutter {
	/** The name of the cut video, in the folder of `recording.json`. */
	static readonly cutVideoFileName = 'cut.mp4';

	/** The name of the file with the clicks, in the folder of `recording.json`. */
	static readonly clicksFileName = 'clicks.json';

	/**
	 * Cuts the raw video of a recording.
	 * @param options.recordingPath The path of the file `recording.json`.
	 * @param options.scenarioPath The path of the scenario file.
	 * @param options.startDelaySeconds The time between the start of the command `screencapture` and the first frame
	 * of the raw video, in seconds.
	 * @returns The content of the file `clicks.json` that was written.
	 */
	static cut(options: { recordingPath: string; scenarioPath: string; startDelaySeconds: number }): ClicksFile {
		const recording = VideoFiles.readRecording(options.recordingPath);
		const scenario = VideoFiles.readScenario(options.scenarioPath);
		const rawVideoPath = VideoFiles.besideRecording(options.recordingPath, recording.rawVideoFileName);
		const loggedClicks = VideoFiles.readClicksLog(
			VideoFiles.besideRecording(options.recordingPath, recording.clicksLogFileName),
		);
		const cutPlan = ClicksBuilder.build({
			loggedClicks,
			scenario,
			recording,
			rawVideoInfo: VideoFiles.probe(rawVideoPath),
			startDelaySeconds: options.startDelaySeconds,
		});
		VideoFiles.cut({
			rawVideoPath,
			cutVideoPath: VideoFiles.besideRecording(options.recordingPath, VideoCutter.cutVideoFileName),
			startSeconds: cutPlan.cutStartSeconds,
			durationSeconds: cutPlan.cutDurationSeconds,
		});
		Fs.writeFileSync(
			VideoFiles.besideRecording(options.recordingPath, VideoCutter.clicksFileName),
			JSON.stringify(cutPlan.clicksFile, null, '\t') + '\n',
		);
		return cutPlan.clicksFile;
	}
}
