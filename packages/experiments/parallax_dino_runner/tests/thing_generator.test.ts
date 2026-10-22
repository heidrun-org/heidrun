import { describe, expect, it } from 'vitest';
import { FallbackCommits, GameSettings, GameStateFactory, SeededRandom, ThingGenerator } from '../src/index.ts';
import type { Thing } from '../src/index.ts';
import { TestStates } from './test_states.ts';

describe('ThingGenerator', () => {
	const sortByDistance = (things: Thing[]): Thing[] => {
		return [...things].sort((first, second) => first.x - second.x);
	};

	it('makes the same world for the same seed', () => {
		const commits = FallbackCommits.create();
		const sameSeed = TestStates.describeThings(TestStates.generateWorld(7, commits).gameState);
		const sameSeedAgain = TestStates.describeThings(TestStates.generateWorld(7, commits).gameState);
		const otherSeed = TestStates.describeThings(TestStates.generateWorld(8, commits).gameState);
		expect(sameSeed).toEqual(sameSeedAgain);
		expect(sameSeed).not.toEqual(otherSeed);
	});

	it('fills the world with the first commits, from the first place up to the spawn distance', () => {
		const commits = FallbackCommits.create();
		let mostCommitCount = 0;
		for (let seed = 1; seed <= 20; seed += 1) {
			const gameState = GameStateFactory.create(0);
			new ThingGenerator(new SeededRandom(seed), commits).prefill(gameState);
			const commitThings = sortByDistance(gameState.things.filter((thing) => thing.commit !== null));
			expect(commitThings[0].x).toBe(GameSettings.FIRST_ROW_X);
			expect(commitThings[commitThings.length - 1].x).toBeLessThanOrEqual(GameSettings.SPAWN_X);
			commitThings.forEach((thing, index) => {
				expect(thing.commit).toBe(commits[index]);
				expect(thing.lane).toBe(commits[index].lane);
			});
			mostCommitCount = Math.max(mostCommitCount, commitThings.length);
		}
		expect(mostCommitCount).toBeGreaterThan(1);
	});

	it('places every commit one time, in order, and then stops', () => {
		const commits = FallbackCommits.create();
		const generatedWorld = TestStates.generateWorld(5, commits);
		const commitThings = sortByDistance(generatedWorld.gameState.things.filter((thing) => thing.commit !== null));
		expect(commitThings.map((thing) => thing.commit?.hash)).toEqual(commits.map((commit) => commit.hash));
		expect(generatedWorld.gameState.lastCommitX).not.toBeNull();
		expect(generatedWorld.gameState.lastCommitX).toBe(commitThings[commitThings.length - 1].x);
	});

	it('does not know the place of the newest commit before that commit appears', () => {
		const gameState = GameStateFactory.create(0);
		new ThingGenerator(new SeededRandom(3), FallbackCommits.create()).prefill(gameState);
		expect(gameState.lastCommitX).toBeNull();
	});

	it('remembers the place of the newest commit when the first prefill places every commit', () => {
		const gameState = GameStateFactory.create(0);
		new ThingGenerator(new SeededRandom(3), TestStates.createCommits([1])).prefill(gameState);
		expect(gameState.lastCommitX).toBe(GameSettings.FIRST_ROW_X);
	});

	it('keeps at least the minimum gap between two commits', () => {
		const generatedWorld = TestStates.generateWorld(5, FallbackCommits.create());
		const commitThings = sortByDistance(generatedWorld.gameState.things.filter((thing) => thing.commit !== null));
		for (let index = 1; index < commitThings.length; index += 1) {
			expect(commitThings[index].x - commitThings[index - 1].x).toBeGreaterThanOrEqual(GameSettings.MINIMUM_GAP);
		}
	});

	it('puts a crate between two commits, never in the place of a commit', () => {
		let crateCount = 0;
		for (let seed = 1; seed <= 20; seed += 1) {
			const generatedWorld = TestStates.generateWorld(seed, FallbackCommits.create());
			const things = sortByDistance(generatedWorld.gameState.things);
			for (let index = 0; index < things.length; index += 1) {
				if (things[index].kind !== 'crate') {
					continue;
				}
				crateCount += 1;
				expect(things[index - 1].commit).not.toBeNull();
				expect(things[index + 1].commit).not.toBeNull();
			}
		}
		expect(crateCount).toBeGreaterThan(20);
	});

	it('never blocks the three lanes of the way with things that stand at the same place', () => {
		const generatedWorld = TestStates.generateWorld(9, FallbackCommits.create());
		const places = generatedWorld.gameState.things.map((thing) => thing.x.toFixed(3));
		expect(new Set(places).size).toBe(places.length);
	});
});
