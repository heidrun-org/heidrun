import { GameSettings } from './game_settings.ts';
import type { CommitRecord } from './commit_types.ts';
import type { GameState, RockSize, Thing } from './game_types.ts';
import { ThingRules } from './thing_rules.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CommitRules — how a commit becomes a thing, and how a run ends
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The rules of the commits: the size of a commit gives the kind and the size of its thing, and the run ends when the
 * dinosaur passes the newest commit.
 */
export class CommitRules {
	/**
	 * Gives the size of the rock of a commit from the lines that the commit changes.
	 * @param linesChanged The lines added plus the lines deleted. It is at least 1.
	 * @returns The size of the rock.
	 */
	static rockSizeFor(linesChanged: number): RockSize {
		if (linesChanged >= GameSettings.LARGE_ROCK_MIN_LINES) {
			return 'large';
		}
		if (linesChanged >= GameSettings.MEDIUM_ROCK_MIN_LINES) {
			return 'medium';
		}
		return 'small';
	}

	/**
	 * Makes the thing of a commit: a cactus when the commit changes no line, and a rock for any other commit.
	 * @param gameState The state of the game, which gives the number of the thing.
	 * @param commit The commit.
	 * @param x The distance in front of the dinosaur, in units.
	 * @returns The new thing, in the lane of the commit.
	 */
	static createThing(gameState: GameState, commit: CommitRecord, x: number): Thing {
		const linesChanged = commit.insertions + commit.deletions;
		const thing =
			linesChanged === 0
				? ThingRules.createCactus(gameState, commit.lane, x)
				: ThingRules.createRock(gameState, commit.lane, x, CommitRules.rockSizeFor(linesChanged));
		thing.commit = commit;
		return thing;
	}

	/**
	 * Finds the next commit in front of the dinosaur: the thing of a commit that is the nearest in front of the
	 * dinosaur. A thing that the dinosaur passed, or that a shot destroyed, does not count.
	 * @param gameState The state of the game.
	 * @returns The thing, or null when no commit is in front of the dinosaur.
	 */
	static nextAhead(gameState: GameState): Thing | null {
		let nextThing: Thing | null = null;
		for (const thing of gameState.things) {
			if (thing.commit === null || thing.x < 0) {
				continue;
			}
			if (nextThing === null || thing.x < nextThing.x) {
				nextThing = thing;
			}
		}
		return nextThing;
	}

	/**
	 * Tells whether the dinosaur passed the newest commit.
	 * @param gameState The state of the game.
	 * @returns True when the newest commit is behind the dinosaur.
	 */
	static hasFinished(gameState: GameState): boolean {
		const hasFinished = gameState.lastCommitX !== null && gameState.lastCommitX < GameSettings.FINISH_X;
		return hasFinished;
	}
}
