import { describe, expect, it } from 'vitest';
import { GameSettings, GameStateFactory, SeededRandom, ThingGenerator, ThingRules } from '../src/index.ts';
import type { Thing } from '../src/index.ts';
import { TestStates } from './test_states.ts';

describe('ThingGenerator', () => {
	it('makes the same world for the same seed', () => {
		const sameSeed = TestStates.describeThings(TestStates.generateWorld(7).gameState);
		const sameSeedAgain = TestStates.describeThings(TestStates.generateWorld(7).gameState);
		const otherSeed = TestStates.describeThings(TestStates.generateWorld(8).gameState);
		expect(sameSeed).toEqual(sameSeedAgain);
		expect(sameSeed).not.toEqual(otherSeed);
	});

	it('fills the world up to the spawn distance at the start', () => {
		const gameState = GameStateFactory.create(0);
		new ThingGenerator(new SeededRandom(3)).prefill(gameState);
		const nearestX = Math.min(...gameState.things.map((thing) => thing.x));
		const farthestX = Math.max(...gameState.things.map((thing) => thing.x));
		expect(nearestX).toBe(GameSettings.FIRST_ROW_X);
		expect(farthestX).toBeLessThanOrEqual(GameSettings.SPAWN_X);
	});

	it('never blocks the three lanes of a row with things that are not easy to jump over', () => {
		for (let seed = 1; seed <= 200; seed += 1) {
			for (const row of TestStates.groupRows(TestStates.generateWorld(seed))) {
				const blockedLanes = row.filter((thing) => {
					return ThingRules.isEasyToJumpOver(thing) === false;
				});
				expect(blockedLanes.length).toBeLessThan(GameSettings.LANE_COUNT);
			}
		}
	});

	it('puts at most one thing in a lane of a row, and at least one thing in a row', () => {
		for (let seed = 1; seed <= 50; seed += 1) {
			for (const row of TestStates.groupRows(TestStates.generateWorld(seed))) {
				const lanes = new Set(row.map((thing) => thing.lane));
				expect(lanes.size).toBe(row.length);
				expect(row.length).toBeGreaterThan(0);
			}
		}
	});

	it('makes every kind of thing and every size of rock', () => {
		const things: Thing[] = [];
		for (let seed = 1; seed <= 20; seed += 1) {
			things.push(...TestStates.generateWorld(seed).gameState.things);
		}
		const kinds = new Set(things.map((thing) => thing.kind));
		const sizes = new Set(things.map((thing) => thing.rockSize));
		expect(kinds).toEqual(new Set(['cactus', 'rock', 'crate']));
		expect(sizes).toEqual(new Set([null, 'small', 'medium', 'large']));
	});

	it('keeps at least the minimum gap between two rows', () => {
		const rows = TestStates.groupRows(TestStates.generateWorld(5));
		expect(rows.length).toBeGreaterThan(50);
		for (let index = 1; index < rows.length; index += 1) {
			const gap = rows[index][0].x - rows[index - 1][0].x;
			expect(gap).toBeGreaterThanOrEqual(GameSettings.MINIMUM_GAP - 0.001);
		}
	});
});
