///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * One left mouse button press written by the click logger.
 */
export type LoggedClick = {
	/** The time of the press, in seconds since 1970-01-01. */
	timeSeconds: number;
	/** The horizontal position of the press, in screen points from the left edge of the main screen. */
	x: number;
	/** The vertical position of the press, in screen points from the top edge of the main screen. */
	y: number;
};

/**
 * The identifier and the bounds of the window that is recorded.
 */
export type WindowBounds = {
	/** The identifier of the window, given to `screencapture -l`. */
	windowId: number;
	/** The horizontal position of the left edge of the window, in screen points. */
	x: number;
	/** The vertical position of the top edge of the window, in screen points. */
	y: number;
	/** The width of the window, in screen points. */
	width: number;
	/** The height of the window, in screen points. */
	height: number;
};

/**
 * The file `recording.json`, written when a recording starts and read when the video is cut.
 */
export type Recording = {
	/** The time when the command `screencapture` was started, in seconds since 1970-01-01. */
	startTimeSeconds: number;
	/** The window that is recorded. */
	window: WindowBounds;
	/** The name of the raw video file, in the same folder as `recording.json`. */
	rawVideoFileName: string;
	/** The name of the file with the clicks written by the click logger, in the same folder as `recording.json`. */
	clicksLogFileName: string;
};

/**
 * A scenario file: the list of the clicks of one video, in the order of the clicks.
 */
export type Scenario = {
	/** The name of the scenario, the same as the name of the file without `.json`. */
	name: string;
	/** One sentence that says what the video shows. */
	description: string;
	/** What each click does, in the order of the clicks. */
	clicks: { label: string }[];
};

/**
 * The size and the length of a video file.
 */
export type VideoInfo = {
	/** The width of the video, in pixels. */
	widthPixels: number;
	/** The height of the video, in pixels. */
	heightPixels: number;
	/** The length of the video, in seconds. */
	durationSeconds: number;
};

/**
 * One click in the file `clicks.json`.
 */
export type ClickEntry = {
	/** The position of the click in the scenario, from 0. */
	index: number;
	/** The time of the click in the cut video, in seconds. */
	timeSeconds: number;
	/** The horizontal position of the click in the cut video, in pixels from the left edge. */
	x: number;
	/** The vertical position of the click in the cut video, in pixels from the top edge. */
	y: number;
	/** What the click does, from the scenario. */
	label: string;
};

/**
 * The file `clicks.json`, written next to the cut video.
 */
export type ClicksFile = {
	/** The name of the scenario. */
	scenario: string;
	/** The size and the length of the cut video. */
	video: VideoInfo;
	/** The clicks, in the order of the scenario. */
	clicks: ClickEntry[];
};

/**
 * Where the video is cut, and the content of `clicks.json`.
 */
export type CutPlan = {
	/** The time in the raw video where the cut video starts, in seconds. */
	cutStartSeconds: number;
	/** The length of the cut video, in seconds. */
	cutDurationSeconds: number;
	/** The content of `clicks.json`. */
	clicksFile: ClicksFile;
};
