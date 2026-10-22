import { describe, expect, it } from 'vitest';
import type { RawCommit } from '../src/commit_export/commit_export_types.ts';
import { LaneAssigner } from '../src/commit_export/lane_assigner.ts';

describe('LaneAssigner', () => {
	const makeCommit = (hash: string, parents: string[], day: number): RawCommit => {
		const rawCommit: RawCommit = {
			hash,
			parents,
			committedAt: new Date(Date.UTC(2026, 0, day)).toISOString(),
			subject: `Commit ${hash}`,
			insertions: 1,
			deletions: 0,
		};
		return rawCommit;
	};
	const laneOf = (hash: string, rawCommits: RawCommit[]): number | undefined => {
		return LaneAssigner.assign(rawCommits).find((commit) => commit.hash === hash)?.lane;
	};

	it('puts a history with no branch in the middle lane, from the oldest commit to the newest commit', () => {
		const rawCommits = [makeCommit('c', ['b'], 3), makeCommit('a', [], 1), makeCommit('b', ['a'], 2)];
		const commits = LaneAssigner.assign(rawCommits);
		expect(commits.map((commit) => commit.hash)).toEqual(['a', 'b', 'c']);
		expect(commits.map((commit) => commit.lane)).toEqual([1, 1, 1]);
		expect(commits.some((commit) => commit.isMerge)).toBe(false);
	});

	it('puts a feature branch in a lane next to the middle lane, and marks the merge commit', () => {
		const rawCommits = [
			makeCommit('start', [], 1),
			makeCommit('feature1', ['start'], 2),
			makeCommit('feature2', ['feature1'], 3),
			makeCommit('main2', ['start'], 4),
			makeCommit('merge', ['main2', 'feature2'], 5),
		];
		const commits = LaneAssigner.assign(rawCommits);
		expect(commits.map((commit) => commit.hash)).toEqual(['start', 'feature1', 'feature2', 'main2', 'merge']);
		expect(laneOf('start', rawCommits)).toBe(1);
		expect(laneOf('main2', rawCommits)).toBe(1);
		expect(laneOf('merge', rawCommits)).toBe(1);
		const featureLane = laneOf('feature1', rawCommits);
		expect([0, 2]).toContain(featureLane);
		expect(laneOf('feature2', rawCommits)).toBe(featureLane);
		expect(commits.find((commit) => commit.hash === 'merge')?.isMerge).toBe(true);
		expect(commits.find((commit) => commit.hash === 'feature2')?.isMerge).toBe(false);
	});

	it('gives two feature branches that live at the same time two different lanes', () => {
		const rawCommits = [
			makeCommit('start', [], 1),
			makeCommit('a1', ['start'], 2),
			makeCommit('b1', ['start'], 3),
			makeCommit('a2', ['a1'], 4),
			makeCommit('b2', ['b1'], 5),
			makeCommit('main2', ['start'], 6),
			makeCommit('merge1', ['main2', 'a2'], 7),
			makeCommit('merge2', ['merge1', 'b2'], 8),
		];
		const laneA = laneOf('a1', rawCommits);
		const laneB = laneOf('b1', rawCommits);
		expect(laneA).not.toBe(1);
		expect(laneB).not.toBe(1);
		expect(laneA).not.toBe(laneB);
		expect(laneOf('a2', rawCommits)).toBe(laneA);
		expect(laneOf('b2', rawCommits)).toBe(laneB);
	});

	it('lets a third feature branch share the lane of the branch that ends first', () => {
		const rawCommits = [
			makeCommit('start', [], 1),
			makeCommit('a1', ['start'], 2),
			makeCommit('b1', ['start'], 3),
			makeCommit('c1', ['start'], 4),
			makeCommit('a2', ['a1'], 5),
			makeCommit('b2', ['b1'], 6),
			makeCommit('b3', ['b2'], 7),
			makeCommit('c2', ['c1'], 8),
			makeCommit('main1', ['start'], 10),
			makeCommit('main2', ['main1'], 11),
			makeCommit('main3', ['main2'], 12),
			makeCommit('main4', ['main3'], 13),
		];
		const laneA = laneOf('a1', rawCommits);
		const laneB = laneOf('b1', rawCommits);
		expect(laneA).not.toBe(1);
		expect(laneB).not.toBe(1);
		expect(laneOf('c1', rawCommits)).toBe(laneA);
		expect(laneOf('c2', rawCommits)).toBe(laneA);
		expect(laneA).not.toBe(laneB);
	});

	it('gives a later feature branch the lane that was free for the longest time', () => {
		const rawCommits = [
			makeCommit('start', [], 1),
			makeCommit('a1', ['start'], 2),
			makeCommit('main2', ['start'], 3),
			makeCommit('merge1', ['main2', 'a1'], 4),
			makeCommit('b1', ['merge1'], 5),
			makeCommit('main3', ['merge1'], 6),
			makeCommit('merge2', ['main3', 'b1'], 7),
		];
		expect(laneOf('b1', rawCommits)).not.toBe(laneOf('a1', rawCommits));
	});

	it('puts every parent before its children, even when a date is wrong', () => {
		const commits = LaneAssigner.assign([makeCommit('child', ['parent'], 1), makeCommit('parent', [], 9)]);
		expect(commits.map((commit) => commit.hash)).toEqual(['parent', 'child']);
	});

	it('ignores a parent that is not in the list, and still marks a commit with two parents as a merge', () => {
		const commits = LaneAssigner.assign([makeCommit('a', ['missing'], 1), makeCommit('b', ['a', 'missing2'], 2)]);
		expect(commits.map((commit) => commit.lane)).toEqual([1, 1]);
		expect(commits[1].isMerge).toBe(true);
	});
});
