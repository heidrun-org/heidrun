import { AmmunitionRules } from './ammunition_rules.ts';
import { GameSettings } from './game_settings.ts';
import type { Dinosaur, GameState, Thing } from './game_types.ts';
import { ThingRules } from './thing_rules.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CollisionRules — what happens when the dinosaur touches a thing
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The rules of the touch between the dinosaur and the things. The dinosaur touches a thing when it shares a lane
 * with the thing, shares the distance with the thing, and its feet are lower than the top of the thing. During a lane
 * change, the dinosaur is in two lanes.
 */
export class CollisionRules {
	/**
	 * Tells whether the dinosaur touches a thing.
	 * @param dinosaur The dinosaur.
	 * @param thing The thing.
	 * @returns True when the dinosaur and the thing touch.
	 */
	static touches(dinosaur: Dinosaur, thing: Thing): boolean {
		if (CollisionRules.isInLane(dinosaur, thing.lane) === false) {
			return false;
		}
		if (Math.abs(thing.x) >= (GameSettings.DINOSAUR_WIDTH + thing.width) / 2) {
			return false;
		}
		const touches = dinosaur.height < thing.height;
		return touches;
	}

	/**
	 * Tells whether the dinosaur is in a lane. During a lane change, the dinosaur is in the two lanes between which
	 * it moves.
	 * @param dinosaur The dinosaur.
	 * @param lane The lane.
	 * @returns True when the dinosaur is in the lane.
	 */
	static isInLane(dinosaur: Dinosaur, lane: number): boolean {
		const firstLane = Math.floor(dinosaur.lanePosition + GameSettings.LANE_TOLERANCE);
		const lastLane = Math.ceil(dinosaur.lanePosition - GameSettings.LANE_TOLERANCE);
		const isInLane = lane >= firstLane && lane <= lastLane;
		return isInLane;
	}

	/**
	 * Applies every touch of the step: the dinosaur picks up a crate, and a cactus or a rock hits the dinosaur.
	 * @param gameState The state of the game.
	 * @returns True when a cactus or a rock hit the dinosaur.
	 */
	static resolve(gameState: GameState): boolean {
		let isHit = false;
		for (const thing of [...gameState.things]) {
			if (CollisionRules.touches(gameState.dinosaur, thing) === false) {
				continue;
			}
			if (ThingRules.isDangerous(thing) === true) {
				isHit = true;
				continue;
			}
			AmmunitionRules.addCrate(gameState);
			ThingRules.remove(gameState.things, thing);
			gameState.events.push('crate');
		}
		return isHit;
	}
}
