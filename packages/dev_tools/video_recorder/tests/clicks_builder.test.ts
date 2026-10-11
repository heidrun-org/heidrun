import { describe, expect, it } from 'vitest';
import { ClicksBuilder } from '../src/clicks_builder.ts';
import type { Recording, Scenario } from '../src/video_recorder_types.ts';

const recording: Recording = {
	startTimeSeconds: 1000,
	window: {
		windowId: 7,
		x: 100,
		y: 50,
		width: 960,
		height: 600,
	},
	rawVideoFileName: 'raw.mov',
	clicksLogFileName: 'clicks_log.jsonl',
};

const scenario: Scenario = {
	name: 'two_clicks',
	description: 'Two clicks.',
	clicks: [{ label: 'First' }, { label: 'Second' }],
};

const rawVideoInfo = {
	widthPixels: 1920,
	heightPixels: 1200,
	durationSeconds: 20,
};

describe('ClicksBuilder', () => {
	it('cuts from 1 second before the first click to 1.5 seconds after the last click', () => {
		const cutPlan = ClicksBuilder.build({
			loggedClicks: [
				{ timeSeconds: 1005, x: 100, y: 50 },
				{ timeSeconds: 1009, x: 580, y: 350 },
			],
			scenario,
			recording,
			rawVideoInfo,
			startDelaySeconds: 0,
		});
		expect(cutPlan.cutStartSeconds).toBe(4);
		expect(cutPlan.cutDurationSeconds).toBe(6.5);
		expect(cutPlan.clicksFile.clicks.map((click) => click.timeSeconds)).toEqual([1, 5]);
	});

	it('converts screen points to video pixels, with the scale of the video', () => {
		const cutPlan = ClicksBuilder.build({
			loggedClicks: [
				{ timeSeconds: 1005, x: 100, y: 50 },
				{ timeSeconds: 1009, x: 580, y: 350 },
			],
			scenario,
			recording,
			rawVideoInfo,
			startDelaySeconds: 0,
		});
		expect(cutPlan.clicksFile.clicks[0]).toEqual({ index: 0, timeSeconds: 1, x: 0, y: 0, label: 'First' });
		expect(cutPlan.clicksFile.clicks[1]).toEqual({ index: 1, timeSeconds: 5, x: 960, y: 600, label: 'Second' });
	});

	it('never starts before the first frame and never ends after the last frame', () => {
		const cutPlan = ClicksBuilder.build({
			loggedClicks: [
				{ timeSeconds: 1000.5, x: 100, y: 50 },
				{ timeSeconds: 1019.5, x: 100, y: 50 },
			],
			scenario,
			recording,
			rawVideoInfo,
			startDelaySeconds: 0,
		});
		expect(cutPlan.cutStartSeconds).toBe(0);
		expect(cutPlan.cutDurationSeconds).toBe(20);
	});

	it('moves the clicks in the video when the start delay changes', () => {
		const cutPlan = ClicksBuilder.build({
			loggedClicks: [
				{ timeSeconds: 1005, x: 100, y: 50 },
				{ timeSeconds: 1009, x: 100, y: 50 },
			],
			scenario,
			recording,
			rawVideoInfo,
			startDelaySeconds: 0.5,
		});
		expect(cutPlan.cutStartSeconds).toBe(3.5);
	});

	it('refuses a number of clicks that is not the number of clicks of the scenario', () => {
		expect(() => {
			ClicksBuilder.build({
				loggedClicks: [{ timeSeconds: 1005, x: 100, y: 50 }],
				scenario,
				recording,
				rawVideoInfo,
				startDelaySeconds: 0,
			});
		}).toThrow('wrote 1 clicks, but the scenario two_clicks has 2 clicks');
	});

	it('refuses an empty list of clicks', () => {
		expect(() => {
			ClicksBuilder.build({ loggedClicks: [], scenario, recording, rawVideoInfo, startDelaySeconds: 0 });
		}).toThrow('did not write any click');
	});
});
