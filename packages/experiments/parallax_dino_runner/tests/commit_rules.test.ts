import { describe, expect, it } from 'vitest';
import { CommitRules, GameSettings, ThingRules } from '../src/index.ts';
import type { CommitRecord } from '../src/index.ts';
import { TestStates } from './test_states.ts';

describe('CommitRules', () => {
	const createCommit = (insertions: number, deletions: number, isMerge: boolean): CommitRecord => {
		const commit: CommitRecord = {
			...TestStates.createCommits([2])[0],
			insertions,
			deletions,
			isMerge,
		};
		return commit;
	};

	it('gives a small rock, a medium rock, or a large rock by the lines that the commit changes', () => {
		expect(CommitRules.rockSizeFor(1)).toBe('small');
		expect(CommitRules.rockSizeFor(GameSettings.MEDIUM_ROCK_MIN_LINES - 1)).toBe('small');
		expect(CommitRules.rockSizeFor(GameSettings.MEDIUM_ROCK_MIN_LINES)).toBe('medium');
		expect(CommitRules.rockSizeFor(GameSettings.LARGE_ROCK_MIN_LINES - 1)).toBe('medium');
		expect(CommitRules.rockSizeFor(GameSettings.LARGE_ROCK_MIN_LINES)).toBe('large');
	});

	it('makes a cactus for a commit that changes no line', () => {
		const gameState = TestStates.createRunning();
		const commit = createCommit(0, 0, false);
		const thing = CommitRules.createThing(gameState, commit, 500);
		expect(thing.kind).toBe('cactus');
		expect(thing.commit).toBe(commit);
		expect(thing.lane).toBe(commit.lane);
		expect(thing.x).toBe(500);
	});

	it('makes a rock for any other commit, and the lines added plus the lines deleted give its size', () => {
		const gameState = TestStates.createRunning();
		const smallThing = CommitRules.createThing(gameState, createCommit(0, 3, false), 0);
		const mediumThing = CommitRules.createThing(gameState, createCommit(60, 60, false), 0);
		const largeThing = CommitRules.createThing(gameState, createCommit(900, 200, false), 0);
		expect(smallThing.kind).toBe('rock');
		expect(smallThing.rockSize).toBe('small');
		expect(mediumThing.rockSize).toBe('medium');
		expect(largeThing.rockSize).toBe('large');
		expect(largeThing.height).toBe(GameSettings.LARGE_ROCK_HEIGHT);
	});

	it('keeps the commit on the thing when a shot makes the rock smaller', () => {
		const gameState = TestStates.createRunning();
		const commit = createCommit(2000, 0, true);
		const thing = CommitRules.createThing(gameState, commit, 0);
		ThingRules.resize(thing, 'medium');
		expect(thing.commit).toBe(commit);
	});

	it('finds the nearest commit in front of the dinosaur, and not a crate or a commit behind', () => {
		const gameState = TestStates.createRunning();
		const behind = CommitRules.createThing(gameState, createCommit(5, 0, false), -20);
		const far = CommitRules.createThing(gameState, createCommit(5, 0, false), 900);
		const near = CommitRules.createThing(gameState, createCommit(5, 0, false), 300);
		const crate = ThingRules.createCrate(gameState, 1, 100);
		gameState.things.push(behind, far, near, crate);
		expect(CommitRules.nextAhead(gameState)).toBe(near);
		gameState.things = [behind, crate];
		expect(CommitRules.nextAhead(gameState)).toBeNull();
	});

	it('finishes the run when the newest commit is far enough behind the dinosaur', () => {
		const gameState = TestStates.createRunning();
		expect(CommitRules.hasFinished(gameState)).toBe(false);
		gameState.lastCommitX = GameSettings.FINISH_X + 1;
		expect(CommitRules.hasFinished(gameState)).toBe(false);
		gameState.lastCommitX = GameSettings.FINISH_X - 1;
		expect(CommitRules.hasFinished(gameState)).toBe(true);
	});
});
