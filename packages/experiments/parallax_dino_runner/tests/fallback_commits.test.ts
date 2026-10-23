import { describe, expect, it } from 'vitest';
import { CommitRules, FallbackCommits, GameSettings } from '../src/index.ts';

describe('FallbackCommits', () => {
	const commits = FallbackCommits.create();

	it('has a cactus, every size of rock, a merge commit, and the three lanes', () => {
		const linesChanged = commits.map((commit) => commit.insertions + commit.deletions);
		expect(linesChanged.some((lines) => lines === 0)).toBe(true);
		const sizes = new Set(linesChanged.filter((lines) => lines > 0).map((lines) => CommitRules.rockSizeFor(lines)));
		expect(sizes).toEqual(new Set(['small', 'medium', 'large']));
		expect(commits.some((commit) => commit.isMerge)).toBe(true);
		expect(new Set(commits.map((commit) => commit.lane))).toEqual(new Set([0, 1, 2]));
	});

	it('has unique hashes, and dates that grow', () => {
		expect(new Set(commits.map((commit) => commit.hash)).size).toBe(commits.length);
		for (let index = 1; index < commits.length; index += 1) {
			expect(commits[index].committedAt > commits[index - 1].committedAt).toBe(true);
		}
	});

	it('keeps every lane inside the lanes of the game', () => {
		for (const commit of commits) {
			expect(commit.lane).toBeGreaterThanOrEqual(0);
			expect(commit.lane).toBeLessThan(GameSettings.LANE_COUNT);
		}
	});
});
