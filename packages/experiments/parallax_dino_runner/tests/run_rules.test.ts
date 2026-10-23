import { describe, expect, it } from 'vitest';
import { GameSettings, ParallaxRules, RunRules, SeededRandom } from '../src/index.ts';

describe('RunRules', () => {
	it('starts at the start speed', () => {
		expect(RunRules.speedAt(0)).toBe(GameSettings.START_SPEED);
	});

	it('goes faster with the distance, up to the maximum speed', () => {
		expect(RunRules.speedAt(1000)).toBeGreaterThan(RunRules.speedAt(0));
		expect(RunRules.speedAt(5000)).toBeGreaterThan(RunRules.speedAt(1000));
		expect(RunRules.speedAt(1_000_000)).toBe(GameSettings.MAX_SPEED);
	});

	it('gives one point of score for each group of units of distance', () => {
		expect(RunRules.score(0)).toBe(0);
		expect(RunRules.score(GameSettings.UNITS_PER_SCORE_POINT - 1)).toBe(0);
		expect(RunRules.score(GameSettings.UNITS_PER_SCORE_POINT * 12 + 3)).toBe(12);
	});
});

describe('ParallaxRules', () => {
	it('moves a layer at a part of the distance of the ground', () => {
		expect(ParallaxRules.layerOffset(100, 1, 1000)).toBe(100);
		expect(ParallaxRules.layerOffset(100, 0.25, 1000)).toBe(25);
	});

	it('repeats the picture of a layer', () => {
		expect(ParallaxRules.layerOffset(1010, 1, 1000)).toBe(10);
		expect(ParallaxRules.layerOffset(4000, 0.5, 1000)).toBe(0);
	});

	it('moves the near layers faster than the far layers', () => {
		const distance = 300;
		const sky = ParallaxRules.layerOffset(distance, GameSettings.PARALLAX_SKY, 5000);
		const mountains = ParallaxRules.layerOffset(distance, GameSettings.PARALLAX_MOUNTAINS, 5000);
		const hills = ParallaxRules.layerOffset(distance, GameSettings.PARALLAX_HILLS, 5000);
		const ground = ParallaxRules.layerOffset(distance, GameSettings.PARALLAX_GROUND, 5000);
		expect(sky).toBeLessThan(mountains);
		expect(mountains).toBeLessThan(hills);
		expect(hills).toBeLessThan(ground);
	});
});

describe('SeededRandom', () => {
	it('gives the same numbers for the same seed', () => {
		const first = new SeededRandom(42);
		const second = new SeededRandom(42);
		for (let index = 0; index < 20; index += 1) {
			expect(first.next()).toBe(second.next());
		}
	});

	it('gives numbers in the limits', () => {
		const random = new SeededRandom(9);
		for (let index = 0; index < 500; index += 1) {
			const number = random.next();
			expect(number).toBeGreaterThanOrEqual(0);
			expect(number).toBeLessThan(1);
			const whole = random.integer(2, 4);
			expect([2, 3, 4]).toContain(whole);
			const between = random.range(10, 20);
			expect(between).toBeGreaterThanOrEqual(10);
			expect(between).toBeLessThan(20);
		}
	});
});
