import type { ClickEntry, CutPlan, LoggedClick, Recording, Scenario, VideoInfo } from './video_recorder_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ClicksBuilder — turns the logged clicks into the cut range and the content of clicks.json
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Pure calculation, without any file or process: it matches the logged clicks with the scenario, chooses where the
 * video is cut, and converts each click to the time and the pixel position in the cut video.
 */
export class ClicksBuilder {
	/** The time kept in the cut video before the first click, in seconds. */
	static readonly secondsBeforeFirstClick = 1;

	/** The time kept in the cut video after the last click, in seconds. */
	static readonly secondsAfterLastClick = 1.5;

	/**
	 * Builds the cut range and the content of `clicks.json`.
	 * @param options.loggedClicks The clicks written by the click logger, in the order of the clicks.
	 * @param options.scenario The scenario of the video.
	 * @param options.recording The content of `recording.json`.
	 * @param options.rawVideoInfo The size and the length of the raw video.
	 * @param options.startDelaySeconds The time between the start of the command `screencapture` and the first frame of
	 * the raw video, in seconds.
	 * @returns The cut range and the content of `clicks.json`.
	 * @throws An `Error` when the number of logged clicks is not the number of clicks of the scenario, or when there is
	 * no click.
	 */
	static build(options: {
		loggedClicks: LoggedClick[];
		scenario: Scenario;
		recording: Recording;
		rawVideoInfo: VideoInfo;
		startDelaySeconds: number;
	}): CutPlan {
		const { loggedClicks, scenario, recording, rawVideoInfo, startDelaySeconds } = options;
		if (loggedClicks.length === 0) {
			throw new Error('The click logger did not write any click.');
		}
		if (loggedClicks.length !== scenario.clicks.length) {
			throw new Error(
				`The click logger wrote ${loggedClicks.length} clicks, but the scenario ${scenario.name} has `
					+ `${scenario.clicks.length} clicks.`,
			);
		}
		const videoStartSeconds = recording.startTimeSeconds + startDelaySeconds;
		const rawClickTimes = loggedClicks.map((loggedClick) => {
			return loggedClick.timeSeconds - videoStartSeconds;
		});
		const firstClickTime = rawClickTimes[0] as number;
		const lastClickTime = rawClickTimes[rawClickTimes.length - 1] as number;
		const cutStartSeconds = Math.max(0, firstClickTime - ClicksBuilder.secondsBeforeFirstClick);
		const cutEndSeconds = Math.min(rawVideoInfo.durationSeconds, lastClickTime + ClicksBuilder.secondsAfterLastClick);
		if (cutEndSeconds <= cutStartSeconds) {
			throw new Error('The clicks are outside the raw video. Check the start time in recording.json.');
		}
		const cutDurationSeconds = cutEndSeconds - cutStartSeconds;
		const pixelsPerPoint = rawVideoInfo.widthPixels / recording.window.width;
		const clickEntries: ClickEntry[] = loggedClicks.map((loggedClick, index) => {
			return {
				index,
				timeSeconds: ClicksBuilder._round((rawClickTimes[index] as number) - cutStartSeconds),
				x: Math.round((loggedClick.x - recording.window.x) * pixelsPerPoint),
				y: Math.round((loggedClick.y - recording.window.y) * pixelsPerPoint),
				label: (scenario.clicks[index] as { label: string }).label,
			};
		});
		return {
			cutStartSeconds: ClicksBuilder._round(cutStartSeconds),
			cutDurationSeconds: ClicksBuilder._round(cutDurationSeconds),
			clicksFile: {
				scenario: scenario.name,
				video: {
					widthPixels: rawVideoInfo.widthPixels,
					heightPixels: rawVideoInfo.heightPixels,
					durationSeconds: ClicksBuilder._round(cutDurationSeconds),
				},
				clicks: clickEntries,
			},
		};
	}

	/**
	 * Rounds a time to the nearest millisecond.
	 * @param seconds The time in seconds.
	 * @returns The time in seconds, with at most three decimals.
	 */
	private static _round(seconds: number): number {
		return Math.round(seconds * 1000) / 1000;
	}
}
