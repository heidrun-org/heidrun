import { GameSettings } from './game_settings.ts';
import type { GameState, RockSize, Thing } from './game_types.ts';
import type { SeededRandom } from './seeded_random.ts';
import { ThingRules } from './thing_rules.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ThingGenerator — places the rows of things in front of the dinosaur
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Places the rows of things in the three lanes, far in front of the dinosaur. A row is the things that stand at the
 * same distance. The generator keeps the world fair: in one row, the dinosaur can always pass in at least one lane
 * without a shot and without a precise jump, because the three lanes never all hold a thing that is not easy to jump
 * over.
 */
export class ThingGenerator {
	/** The random number generator that decides each row. */
	private _random: SeededRandom;

	/** The distance that the world went through since the last row appeared, in units. */
	private _distanceSinceLastRow = 0;

	/** The distance between the last row and the next row, in units. */
	private _nextGap = 0;

	/**
	 * @param random The random number generator that decides each row.
	 */
	constructor(random: SeededRandom) {
		this._random = random;
	}

	/**
	 * Fills the world with rows, from the first row up to the spawn distance. It runs at the start of a run.
	 * @param gameState The state of the game.
	 */
	prefill(gameState: GameState): void {
		let lastRowX = GameSettings.FIRST_ROW_X;
		this._createRow(gameState, lastRowX);
		this._nextGap = this._computeGap(gameState);
		while (lastRowX + this._nextGap <= GameSettings.SPAWN_X) {
			lastRowX += this._nextGap;
			this._createRow(gameState, lastRowX);
			this._nextGap = this._computeGap(gameState);
		}
		this._distanceSinceLastRow = GameSettings.SPAWN_X - lastRowX;
	}

	/**
	 * Adds a new row at the spawn distance each time that the world went far enough.
	 * @param gameState The state of the game.
	 * @param distanceMoved The distance that the world went through in this step, in units.
	 */
	step(gameState: GameState, distanceMoved: number): void {
		this._distanceSinceLastRow += distanceMoved;
		while (this._distanceSinceLastRow >= this._nextGap) {
			this._distanceSinceLastRow -= this._nextGap;
			this._createRow(gameState, GameSettings.SPAWN_X - this._distanceSinceLastRow);
			this._nextGap = this._computeGap(gameState);
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Computes the distance to the next row. The gap grows with the speed of the world, so the player keeps the same
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
	 * Chooses a size for a new rock.
	 * @returns The size.
	 */
	private _chooseRockSize(): RockSize {
		const roll = this._random.next();
		if (roll < GameSettings.SMALL_ROCK_CHANCE) {
			return 'small';
		}
		if (roll < GameSettings.SMALL_ROCK_CHANCE + GameSettings.MEDIUM_ROCK_CHANCE) {
			return 'medium';
		}
		return 'large';
	}

	/**
	 * Makes the thing of one lane of a row.
	 * @param gameState The state of the game.
	 * @param lane The lane.
	 * @param x The distance of the row, in units.
	 * @returns The thing, or null when the lane stays empty.
	 */
	private _createThing(gameState: GameState, lane: number, x: number): Thing | null {
		const roll = this._random.next();
		if (roll < GameSettings.EMPTY_LANE_CHANCE) {
			return null;
		}
		if (roll < GameSettings.EMPTY_LANE_CHANCE + GameSettings.CACTUS_CHANCE) {
			return ThingRules.createCactus(gameState, lane, x);
		}
		return ThingRules.createRock(gameState, lane, x, this._chooseRockSize());
	}

	/**
	 * Adds one row of things to the world. The row is never empty, it is always fair, and it sometimes holds a crate.
	 * @param gameState The state of the game.
	 * @param x The distance of the row, in units.
	 */
	private _createRow(gameState: GameState, x: number): void {
		const row: (Thing | null)[] = [];
		for (let lane = 0; lane < GameSettings.LANE_COUNT; lane += 1) {
			row.push(this._createThing(gameState, lane, x));
		}
		this._makeRowNotEmpty(gameState, row, x);
		this._makeRowFair(row);
		this._addCrate(gameState, row, x);
		for (const thing of row) {
			if (thing !== null) {
				gameState.things.push(thing);
			}
		}
	}

	/**
	 * Puts a cactus in a random lane when the row is empty.
	 * @param gameState The state of the game.
	 * @param row The things of the row, one for each lane. A lane without a thing holds null.
	 * @param x The distance of the row, in units.
	 */
	private _makeRowNotEmpty(gameState: GameState, row: (Thing | null)[], x: number): void {
		const hasThing = row.some((thing) => {
			return thing !== null;
		});
		if (hasThing === true) {
			return;
		}
		const lane = this._random.integer(0, GameSettings.LANE_COUNT - 1);
		row[lane] = ThingRules.createCactus(gameState, lane, x);
	}

	/**
	 * Empties a random lane when the three lanes all hold a thing that is not easy to jump over.
	 * @param row The things of the row, one for each lane. A lane without a thing holds null.
	 */
	private _makeRowFair(row: (Thing | null)[]): void {
		const isBlocked = row.every((thing) => {
			return thing !== null && ThingRules.isEasyToJumpOver(thing) === false;
		});
		if (isBlocked === false) {
			return;
		}
		const lane = this._random.integer(0, GameSettings.LANE_COUNT - 1);
		row[lane] = null;
	}

	/**
	 * Sometimes puts a crate of ammunition in an empty lane of the row.
	 * @param gameState The state of the game.
	 * @param row The things of the row, one for each lane. A lane without a thing holds null.
	 * @param x The distance of the row, in units.
	 */
	private _addCrate(gameState: GameState, row: (Thing | null)[], x: number): void {
		if (this._random.next() >= GameSettings.CRATE_ROW_CHANCE) {
			return;
		}
		const emptyLanes: number[] = [];
		for (let lane = 0; lane < row.length; lane += 1) {
			if (row[lane] === null) {
				emptyLanes.push(lane);
			}
		}
		if (emptyLanes.length === 0) {
			return;
		}
		const lane = emptyLanes[this._random.integer(0, emptyLanes.length - 1)];
		row[lane] = ThingRules.createCrate(gameState, lane, x);
	}
}
