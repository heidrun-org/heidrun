import { describe, expect, it } from 'vitest';
import { GameSettings, ThingRules } from '../src/index.ts';
import type { GameState, RockSize, Thing } from '../src/index.ts';
import { TestStates } from './test_states.ts';

const FAST_DISTANCE = 100000;

describe('Jump difficulty', () => {
	const createCactus = (gameState: GameState, x: number): Thing => {
		return ThingRules.createCactus(gameState, 1, x);
	};
	const createRock = (rockSize: RockSize) => {
		return (gameState: GameState, x: number): Thing => {
			return ThingRules.createRock(gameState, 1, x, rockSize);
		};
	};

	it('says which things are easy to jump over, hard to jump over, or impossible to jump over', () => {
		const gameState = TestStates.createRunning();
		const crate = ThingRules.createCrate(gameState, 1, 0);
		const cactus = createCactus(gameState, 0);
		const smallRock = createRock('small')(gameState, 0);
		const mediumRock = createRock('medium')(gameState, 0);
		const largeRock = createRock('large')(gameState, 0);
		for (const easyThing of [crate, cactus, smallRock]) {
			expect(ThingRules.isEasyToJumpOver(easyThing)).toBe(true);
			expect(ThingRules.canJumpOver(easyThing)).toBe(true);
		}
		expect(ThingRules.isEasyToJumpOver(mediumRock)).toBe(false);
		expect(ThingRules.canJumpOver(mediumRock)).toBe(true);
		expect(ThingRules.isEasyToJumpOver(largeRock)).toBe(false);
		expect(ThingRules.canJumpOver(largeRock)).toBe(false);
	});

	it('gives the jump a lot of room for error over a cactus and over a small rock', () => {
		for (const distance of [0, FAST_DISTANCE]) {
			expect(TestStates.countJumpsThatClear(createCactus, distance)).toBeGreaterThanOrEqual(15);
			expect(TestStates.countJumpsThatClear(createRock('small'), distance)).toBeGreaterThanOrEqual(15);
		}
	});

	it('gives the jump little room for error over a medium rock, but some', () => {
		for (const distance of [0, FAST_DISTANCE]) {
			const clearCount = TestStates.countJumpsThatClear(createRock('medium'), distance);
			expect(clearCount).toBeGreaterThanOrEqual(3);
			expect(clearCount).toBeLessThanOrEqual(12);
		}
	});

	it('never lets a jump clear a large rock', () => {
		for (const distance of [0, FAST_DISTANCE]) {
			expect(TestStates.countJumpsThatClear(createRock('large'), distance)).toBe(0);
		}
	});

	it('keeps the top of a jump between the medium rock and the large rock', () => {
		expect(GameSettings.JUMP_HEIGHT).toBeGreaterThan(GameSettings.MEDIUM_ROCK_HEIGHT);
		expect(GameSettings.JUMP_HEIGHT).toBeLessThan(GameSettings.LARGE_ROCK_HEIGHT);
	});
});
