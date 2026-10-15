import type { CommitRecord } from '../index.ts';
import { GameSettings } from '../index.ts';
import type { RawCommit } from './commit_export_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	LaneAssigner — puts the commits in order and gives each commit its lane
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A line of history that is not the main line: commits that follow each other through their first parents.
 */
type Line = {
	/** The place in the sorted list of the first commit of the line. */
	first: number;
	/** The place in the sorted list of the last commit of the line. */
	last: number;
};

/**
 * Puts the commits of a repository in the order of the game, and gives each commit its lane. It uses no file and no
 * command, so a test can give it a list of commits. The order puts every parent before its children, and it puts the
 * older commit first when it can. The main line is the longest chain of first parents, and its commits go in the
 * middle lane. Every other chain of first parents is a feature line, and it goes in a lane next to the main line.
 */
export class LaneAssigner {
	/**
	 * Sorts the commits and gives each commit its lane.
	 * @param rawCommits The commits, in any order.
	 * @returns The commits of the game, from the oldest commit to the newest commit.
	 */
	static assign(rawCommits: RawCommit[]): CommitRecord[] {
		const sortedCommits = LaneAssigner._sort(rawCommits);
		const placeByHash = new Map<string, number>();
		sortedCommits.forEach((commit, place) => {
			placeByHash.set(commit.hash, place);
		});
		const firstParentPlaces = sortedCommits.map((commit) => {
			const firstParentPlace = commit.parents.length === 0 ? undefined : placeByHash.get(commit.parents[0]);
			return firstParentPlace === undefined ? null : firstParentPlace;
		});
		const isOnMainLine = LaneAssigner._findMainLine(firstParentPlaces);
		const lines: Line[] = [];
		const lineOfPlace = LaneAssigner._findLines(firstParentPlaces, isOnMainLine, lines);
		const laneOfLine = LaneAssigner._giveLanesToLines(lines);
		const commits = sortedCommits.map((commit, place) => {
			const lane = isOnMainLine[place] === true ? GameSettings.START_LANE : laneOfLine[lineOfPlace[place]];
			const commitRecord: CommitRecord = {
				hash: commit.hash,
				committedAt: commit.committedAt,
				subject: commit.subject,
				insertions: commit.insertions,
				deletions: commit.deletions,
				isMerge: commit.parents.length >= 2,
				lane,
			};
			return commitRecord;
		});
		return commits;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Tells whether a commit goes before another commit when both are ready to go: the older date goes first, and the
	 * hash breaks a tie.
	 * @param first The first commit.
	 * @param second The second commit.
	 * @returns True when the first commit goes before the second commit.
	 */
	private static _goesBefore(first: RawCommit, second: RawCommit): boolean {
		if (first.committedAt !== second.committedAt) {
			return first.committedAt < second.committedAt;
		}
		return first.hash < second.hash;
	}

	/**
	 * Sorts the commits so that every parent goes before its children, and the older commit goes first when both are
	 * ready. A parent that is not in the list is ignored.
	 * @param rawCommits The commits, in any order.
	 * @returns The sorted commits.
	 */
	private static _sort(rawCommits: RawCommit[]): RawCommit[] {
		const commitByHash = new Map<string, RawCommit>();
		for (const commit of rawCommits) {
			commitByHash.set(commit.hash, commit);
		}
		const waitingParentCount = new Map<string, number>();
		const childHashes = new Map<string, string[]>();
		for (const commit of rawCommits) {
			const parentHashes = new Set(commit.parents.filter((parent) => commitByHash.has(parent)));
			waitingParentCount.set(commit.hash, parentHashes.size);
			for (const parentHash of parentHashes) {
				childHashes.set(parentHash, [...(childHashes.get(parentHash) ?? []), commit.hash]);
			}
		}
		const readyCommits = rawCommits.filter((commit) => waitingParentCount.get(commit.hash) === 0);
		const sortedCommits: RawCommit[] = [];
		while (readyCommits.length > 0) {
			let firstPlace = 0;
			for (let place = 1; place < readyCommits.length; place += 1) {
				if (LaneAssigner._goesBefore(readyCommits[place], readyCommits[firstPlace]) === true) {
					firstPlace = place;
				}
			}
			const [commit] = readyCommits.splice(firstPlace, 1);
			sortedCommits.push(commit);
			for (const childHash of childHashes.get(commit.hash) ?? []) {
				const waitingCount = (waitingParentCount.get(childHash) ?? 0) - 1;
				waitingParentCount.set(childHash, waitingCount);
				if (waitingCount === 0) {
					readyCommits.push(commitByHash.get(childHash) as RawCommit);
				}
			}
		}
		if (sortedCommits.length !== rawCommits.length) {
			throw new Error('The commits have a loop of parents, so they cannot be sorted.');
		}
		return sortedCommits;
	}

	/**
	 * Finds the main line: the longest chain of first parents. When two chains have the same length, the chain that
	 * ends with the newer commit wins.
	 * @param firstParentPlaces The place of the first parent of each commit, or null when it has none.
	 * @returns For each place, true when the commit is on the main line.
	 */
	private static _findMainLine(firstParentPlaces: (number | null)[]): boolean[] {
		const chainLengths: number[] = [];
		let longestPlace = 0;
		for (let place = 0; place < firstParentPlaces.length; place += 1) {
			const firstParentPlace = firstParentPlaces[place];
			chainLengths.push(firstParentPlace === null ? 1 : chainLengths[firstParentPlace] + 1);
			if (chainLengths[place] >= chainLengths[longestPlace]) {
				longestPlace = place;
			}
		}
		const isOnMainLine = firstParentPlaces.map(() => false);
		let place: number | null = longestPlace;
		while (place !== null) {
			isOnMainLine[place] = true;
			place = firstParentPlaces[place];
		}
		return isOnMainLine;
	}

	/**
	 * Cuts the commits that are not on the main line into lines. A commit joins the line of its first parent when no
	 * other commit joined it before. Otherwise it starts a new line.
	 * @param firstParentPlaces The place of the first parent of each commit, or null when it has none.
	 * @param isOnMainLine For each place, true when the commit is on the main line.
	 * @param lines The list that this method fills with the lines, in the order of their first commit.
	 * @returns For each place, the number of its line. The number is meaningless for a commit of the main line.
	 */
	private static _findLines(firstParentPlaces: (number | null)[], isOnMainLine: boolean[], lines: Line[]): number[] {
		const lineOfPlace: number[] = firstParentPlaces.map(() => -1);
		const isContinued = firstParentPlaces.map(() => false);
		for (let place = 0; place < firstParentPlaces.length; place += 1) {
			if (isOnMainLine[place] === true) {
				continue;
			}
			const firstParentPlace = firstParentPlaces[place];
			const hasFreeParentLine =
				firstParentPlace !== null &&
				isOnMainLine[firstParentPlace] === false &&
				isContinued[firstParentPlace] === false;
			if (firstParentPlace !== null && hasFreeParentLine === true) {
				lineOfPlace[place] = lineOfPlace[firstParentPlace];
				isContinued[firstParentPlace] = true;
			} else {
				lineOfPlace[place] = lines.length;
				lines.push({
					first: place,
					last: place,
				});
			}
			lines[lineOfPlace[place]].last = place;
		}
		return lineOfPlace;
	}

	/**
	 * Gives a lane next to the main line to each line. A line takes a lane that is free when the line starts, and the
	 * lane that was free for the longest time goes first. When no lane is free, the line shares the lane of the line
	 * that ends first.
	 * @param lines The lines, in the order of their first commit.
	 * @returns For each line, its lane.
	 */
	private static _giveLanesToLines(lines: Line[]): number[] {
		const branchLanes: number[] = [];
		for (let lane = 0; lane < GameSettings.LANE_COUNT; lane += 1) {
			if (lane !== GameSettings.START_LANE) {
				branchLanes.push(lane);
			}
		}
		const lastPlaces = branchLanes.map(() => -1);
		const laneOfLine: number[] = [];
		for (const line of lines) {
			const freeIndexes = lastPlaces.flatMap((lastPlace, index) => (lastPlace < line.first ? [index] : []));
			const candidates = freeIndexes.length > 0 ? freeIndexes : lastPlaces.map((_lastPlace, index) => index);
			let chosenIndex = candidates[0];
			for (const index of candidates) {
				if (lastPlaces[index] < lastPlaces[chosenIndex]) {
					chosenIndex = index;
				}
			}
			laneOfLine.push(branchLanes[chosenIndex]);
			lastPlaces[chosenIndex] = Math.max(lastPlaces[chosenIndex], line.last);
		}
		return laneOfLine;
	}
}
