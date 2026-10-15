import { GameSettings } from './game_settings.ts';
import type { GameState, RockSize, Thing, ThingDimensions } from './game_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ThingRules — the cacti, the rocks, and the crates that stand in the lanes
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The rules of the things in the lanes: how to make each kind, how high it is, and whether the dinosaur can jump
 * over it.
 */
export class ThingRules {
	/**
	 * Takes the next number for a thing, a bullet, or a piece.
	 * @param gameState The state of the game.
	 * @returns The number.
	 */
	static takeId(gameState: GameState): number {
		const id = gameState.nextId;
		gameState.nextId += 1;
		return id;
	}

	/**
	 * Makes a cactus.
	 * @param gameState The state of the game, which gives the number of the cactus.
	 * @param lane The lane of the cactus.
	 * @param x The distance in front of the dinosaur, in units.
	 * @returns The new cactus.
	 */
	static createCactus(gameState: GameState, lane: number, x: number): Thing {
		const thing: Thing = {
			id: ThingRules.takeId(gameState),
			kind: 'cactus',
			rockSize: null,
			lane,
			x,
			width: GameSettings.CACTUS_WIDTH,
			height: GameSettings.CACTUS_HEIGHT,
		};
		return thing;
	}

	/**
	 * Makes a rock.
	 * @param gameState The state of the game, which gives the number of the rock.
	 * @param lane The lane of the rock.
	 * @param x The distance in front of the dinosaur, in units.
	 * @param rockSize The size of the rock.
	 * @returns The new rock.
	 */
	static createRock(gameState: GameState, lane: number, x: number, rockSize: RockSize): Thing {
		const dimensions = ThingRules.rockDimensions(rockSize);
		const thing: Thing = {
			id: ThingRules.takeId(gameState),
			kind: 'rock',
			rockSize,
			lane,
			x,
			width: dimensions.width,
			height: dimensions.height,
		};
		return thing;
	}

	/**
	 * Makes a crate of ammunition.
	 * @param gameState The state of the game, which gives the number of the crate.
	 * @param lane The lane of the crate.
	 * @param x The distance in front of the dinosaur, in units.
	 * @returns The new crate.
	 */
	static createCrate(gameState: GameState, lane: number, x: number): Thing {
		const thing: Thing = {
			id: ThingRules.takeId(gameState),
			kind: 'crate',
			rockSize: null,
			lane,
			x,
			width: GameSettings.CRATE_WIDTH,
			height: GameSettings.CRATE_HEIGHT,
		};
		return thing;
	}

	/**
	 * Gives the width and the height of a rock of one size.
	 * @param rockSize The size of the rock.
	 * @returns The width and the height, in units.
	 */
	static rockDimensions(rockSize: RockSize): ThingDimensions {
		if (rockSize === 'small') {
			const dimensions: ThingDimensions = {
				width: GameSettings.SMALL_ROCK_WIDTH,
				height: GameSettings.SMALL_ROCK_HEIGHT,
			};
			return dimensions;
		}
		if (rockSize === 'medium') {
			const dimensions: ThingDimensions = {
				width: GameSettings.MEDIUM_ROCK_WIDTH,
				height: GameSettings.MEDIUM_ROCK_HEIGHT,
			};
			return dimensions;
		}
		const dimensions: ThingDimensions = {
			width: GameSettings.LARGE_ROCK_WIDTH,
			height: GameSettings.LARGE_ROCK_HEIGHT,
		};
		return dimensions;
	}

	/**
	 * Gives the size of a rock after one shot.
	 * @param rockSize The size of the rock before the shot.
	 * @returns The next smaller size, or null when the shot destroys the rock.
	 */
	static smallerSize(rockSize: RockSize): RockSize | null {
		if (rockSize === 'large') {
			return 'medium';
		}
		if (rockSize === 'medium') {
			return 'small';
		}
		return null;
	}

	/**
	 * Changes the size of a rock. The width and the height change with the size.
	 * @param thing The rock.
	 * @param rockSize The new size.
	 */
	static resize(thing: Thing, rockSize: RockSize): void {
		const dimensions = ThingRules.rockDimensions(rockSize);
		thing.rockSize = rockSize;
		thing.width = dimensions.width;
		thing.height = dimensions.height;
	}

	/**
	 * Tells whether a jump can clear a thing: the top of a jump is higher than the thing. A thing that is not easy to
	 * jump over needs a precise jump, because the dinosaur is high enough for a short time only.
	 * @param thing The thing.
	 * @returns True when a jump clears the thing at the right time.
	 */
	static canJumpOver(thing: Thing): boolean {
		const canJumpOver = thing.height < GameSettings.JUMP_HEIGHT;
		return canJumpOver;
	}

	/**
	 * Tells whether a jump over a thing has a lot of room for error: a cactus, a small rock, and a crate.
	 * @param thing The thing.
	 * @returns True when the thing is easy to jump over.
	 */
	static isEasyToJumpOver(thing: Thing): boolean {
		const isEasyToJumpOver = thing.height <= GameSettings.EASY_JUMP_HEIGHT;
		return isEasyToJumpOver;
	}

	/**
	 * Tells whether a thing stops the dinosaur when it touches the thing: a cactus or a rock.
	 * @param thing The thing.
	 * @returns True for a cactus and for a rock, false for a crate.
	 */
	static isDangerous(thing: Thing): boolean {
		const isDangerous = thing.kind !== 'crate';
		return isDangerous;
	}

	/**
	 * Takes a thing out of a list of things.
	 * @param things The list of things.
	 * @param thing The thing to take out.
	 */
	static remove(things: Thing[], thing: Thing): void {
		const index = things.indexOf(thing);
		if (index >= 0) {
			things.splice(index, 1);
		}
	}

	/**
	 * Takes out the things that went far behind the dinosaur.
	 * @param gameState The state of the game.
	 */
	static removeBehind(gameState: GameState): void {
		gameState.things = gameState.things.filter((thing) => {
			return thing.x >= GameSettings.REMOVE_X;
		});
	}
}
