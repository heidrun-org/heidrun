import { ProgramRunner } from './program_runner.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MusicAnalyzer — finds where the sound of a music file ends, before its last silence
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Reads a music file with the filter `silencedetect` of the program `ffmpeg`. A track often ends with a silence, so the
 * end of its sound comes before the end of its file. The outro of a video ends with the end of the sound, not with the
 * end of the file.
 */
export class MusicAnalyzer {
	/** The level under which the sound counts as silence. */
	private static readonly _SILENCE_LEVEL = '-50dB';

	/** The shortest silence that counts, in seconds. */
	private static readonly _SILENCE_MINIMUM_SECONDS = 0.1;

	/** How far from the end of the file a silence can stop and still count as the silence at the end, in seconds. */
	private static readonly _END_TOLERANCE_SECONDS = 0.3;

	/**
	 * Finds the time when the last silence at the end of a music file starts.
	 * @param path The path of the music file.
	 * @returns The time of the end of the sound, in seconds. It is the length of the file when the file has no silence
	 * at its end.
	 */
	static async findSoundEndSeconds(path: string): Promise<number> {
		const { standardError } = await ProgramRunner.run('ffmpeg', [
			...['-hide_banner', '-i', path],
			...['-af', `silencedetect=noise=${MusicAnalyzer._SILENCE_LEVEL}:d=${MusicAnalyzer._SILENCE_MINIMUM_SECONDS}`],
			...['-f', 'null', '-'],
		]);
		return MusicAnalyzer.parseSoundEndSeconds(standardError);
	}

	/**
	 * Reads the report of the program `ffmpeg` and finds the end of the sound.
	 * @param report The text that the program `ffmpeg` wrote on its standard error.
	 * @returns The time of the end of the sound, in seconds.
	 * @throws An error when the report has no length of file.
	 */
	static parseSoundEndSeconds(report: string): number {
		const durationMatch = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(report);
		if (durationMatch === null) {
			throw new Error('The report of ffmpeg has no length of file.');
		}
		const durationSeconds =
			Number.parseInt(durationMatch[1], 10) * 3600 +
			Number.parseInt(durationMatch[2], 10) * 60 +
			Number.parseFloat(durationMatch[3]);
		const starts = [...report.matchAll(/silence_start: (\d+(?:\.\d+)?)/g)].map((match) => Number.parseFloat(match[1]));
		const ends = [...report.matchAll(/silence_end: (\d+(?:\.\d+)?)/g)].map((match) => Number.parseFloat(match[1]));
		if (starts.length === 0) {
			return durationSeconds;
		}
		const lastStart = starts[starts.length - 1];
		const lastEnd = ends.length === starts.length ? ends[ends.length - 1] : null;
		const isAtTheEnd = lastEnd === null || lastEnd >= durationSeconds - MusicAnalyzer._END_TOLERANCE_SECONDS;
		return isAtTheEnd === true ? lastStart : durationSeconds;
	}
}
