import { GameSettings } from './game_settings.ts';
import type { CommitRecord } from './commit_types.ts';
import { CommitRules } from './commit_rules.ts';
import type { GameState } from './game_types.ts';
import type { SeededRandom } from './seeded_random.ts';
import { ThingRules } from './thing_rules.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ThingGenerator — places the commits and the crates in front of the dinosaur
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Places the commits in front of the dinosaur, one commit after the other, from the oldest commit to the newest
 * commit. Each commit has its own place along the way, so the three lanes are never all blocked. Between two commits,
 * a crate of ammunition sometimes appears in a random lane.
 */
export class ThingGenerator {
	/** The random number generator that decides the gaps and the crates. */
	private _random: SeededRandom;

	/** The commits to place, from the oldest commit to the newest commit. */
	private _commits: CommitRecord[];

	/** The number of the next commit to place. */
	private _nextCommitIndex = 0;

	/** The distance that the world went through since the last commit appeared, in units. */
	private _distanceSinceLastCommit = 0;

	/** The distance between the last commit and the next commit, in units. */
	private _nextGap = 0;

	/**
	 * @param random The random number generator that decides the gaps and the crates.
	 * @param commits The commits to place, from the oldest commit to the newest commit.
	 */
	constructor(random: SeededRandom, commits: CommitRecord[]) {
		this._random = random;
		this._commits = commits;
	}

	/**
	 * Fills the world with commits, from the first commit up to the spawn distance. It runs at the start of a run.
	 * @param gameState The state of the game.
	 */
	prefill(gameState: GameState): void {
		let lastCommitX = GameSettings.FIRST_ROW_X;
		this._placeCommit(gameState, lastCommitX, 0);
		this._nextGap = this._computeGap(gameState);
		while (this._hasCommitLeft() === true && lastCommitX + this._nextGap <= GameSettings.SPAWN_X) {
			lastCommitX += this._nextGap;
			this._placeCommit(gameState, lastCommitX, this._nextGap);
			this._nextGap = this._computeGap(gameState);
		}
		this._distanceSinceLastCommit = GameSettings.SPAWN_X - lastCommitX;
	}

	/**
	 * Adds the next commit at the spawn distance each time that the world went far enough. Nothing happens after the
	 * newest commit.
	 * @param gameState The state of the game.
	 * @param distanceMoved The distance that the world went through in this step, in units.
	 */
	step(gameState: GameState, distanceMoved: number): void {
		if (this._hasCommitLeft() === false) {
			return;
		}
		this._distanceSinceLastCommit += distanceMoved;
		while (this._hasCommitLeft() === true && this._distanceSinceLastCommit >= this._nextGap) {
			this._distanceSinceLastCommit -= this._nextGap;
			this._placeCommit(gameState, GameSettings.SPAWN_X - this._distanceSinceLastCommit, this._nextGap);
			this._nextGap = this._computeGap(gameState);
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Tells whether a commit is still to place.
	 * @returns True when the newest commit is not placed yet.
	 */
	private _hasCommitLeft(): boolean {
		const hasCommitLeft = this._nextCommitIndex < this._commits.length;
		return hasCommitLeft;
	}

	/**
	 * Computes the distance to the next commit. The gap grows with the speed of the world, so the player keeps the same
	 * time to react.
	 * @param gameState The state of the game.
	 * @returns The distance, in units.
	 */
	private _computeGap(gameState: GameState): number {
		const reactionGap = gameState.speed * GameSettings.GAP_SECONDS;
		const gap = Math.max(GameSettings.MINIMUM_GAP, reactionGap) + this._random.range(0, GameSettings.GAP_RANDOM);
		return gap;
	}

	/**
	 * Places the next commit, and sometimes a crate of ammunition half way between the last commit and this commit.
	 * When the commit is the newest commit, the state remembers where it is, so the run can end.
	 * @param gameState The state of the game.
	 * @param x The distance of the commit, in units.
	 * @param gapBefore The distance between the last commit and this commit, in units. It is 0 for the first commit.
	 */
	private _placeCommit(gameState: GameState, x: number, gapBefore: number): void {
		const commit = this._commits[this._nextCommitIndex];
		this._nextCommitIndex += 1;
		gameState.things.push(CommitRules.createThing(gameState, commit, x));
		if (this._hasCommitLeft() === false) {
			gameState.lastCommitX = x;
		}
		if (gapBefore > 0 && this._random.next() < GameSettings.CRATE_ROW_CHANCE) {
			const lane = this._random.integer(0, GameSettings.LANE_COUNT - 1);
			gameState.things.push(ThingRules.createCrate(gameState, lane, x - gapBefore / 2));
		}
	}
}
