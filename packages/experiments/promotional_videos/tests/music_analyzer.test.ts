import { describe, expect, it } from 'vitest';
import { MusicAnalyzer } from '../src/music_analyzer.ts';

describe('MusicAnalyzer.parseSoundEndSeconds', () => {
	it('gives the start of the silence that lasts until the end of the file', () => {
		const report = [
			'  Duration: 00:00:27.96, start: 0.000000, bitrate: 256 kb/s',
			'[silencedetect @ 0x1] silence_start: 27.750583',
			'[silencedetect @ 0x1] silence_end: 27.932083 | silence_duration: 0.1815',
		].join('\n');
		expect(MusicAnalyzer.parseSoundEndSeconds(report)).toBeCloseTo(27.750583, 5);
	});

	it('gives the start of a last silence that the report never closes', () => {
		const report = ['  Duration: 00:01:02.50, start: 0.0', '[silencedetect @ 0x1] silence_start: 58.2'].join('\n');
		expect(MusicAnalyzer.parseSoundEndSeconds(report)).toBeCloseTo(58.2, 5);
	});

	it('gives the length of the file when the only silence is in the middle of the track', () => {
		const report = [
			'  Duration: 00:00:30.00, start: 0.0',
			'[silencedetect @ 0x1] silence_start: 10.0',
			'[silencedetect @ 0x1] silence_end: 12.0 | silence_duration: 2.0',
		].join('\n');
		expect(MusicAnalyzer.parseSoundEndSeconds(report)).toBe(30);
	});

	it('gives the length of the file when the track has no silence', () => {
		expect(MusicAnalyzer.parseSoundEndSeconds('  Duration: 00:00:05.25, start: 0.0')).toBe(5.25);
	});

	it('fails when the report has no length of file', () => {
		expect(() => MusicAnalyzer.parseSoundEndSeconds('nothing here')).toThrow(/no length/);
	});
});
