import { GameSettings } from './game_settings.ts';
import type { Dinosaur } from './game_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DinosaurRules — the lane change and the jump of the dinosaur
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The rules of the dinosaur: it changes lane, it jumps, and it falls back to the ground.
 */
export class DinosaurRules {
	/**
	 * Makes a dinosaur that stands on the ground in the start lane.
	 * @returns The new dinosaur.
	 */
	static create(): Dinosaur {
		const dinosaur: Dinosaur = {
			lanePosition: GameSettings.START_LANE,
			targetLane: GameSettings.START_LANE,
			height: 0,
			verticalSpeed: 0,
		};
		return dinosaur;
	}

	/**
	 * Tells whether the dinosaur stands on the ground.
	 * @param dinosaur The dinosaur.
	 * @returns True when the dinosaur is not in the air.
	 */
	static isOnGround(dinosaur: Dinosaur): boolean {
		const isOnGround = dinosaur.height === 0 && dinosaur.verticalSpeed === 0;
		return isOnGround;
	}

	/**
	 * Gives the lane where a shot of the dinosaur flies: the nearest lane.
	 * @param dinosaur The dinosaur.
	 * @returns The lane, as a whole number.
	 */
	static shootingLane(dinosaur: Dinosaur): number {
		const lane = Math.round(dinosaur.lanePosition);
		return lane;
	}

	/**
	 * Sends the dinosaur to the next lane. The dinosaur stops at the first lane and at the last lane.
	 * @param dinosaur The dinosaur.
	 * @param direction -1 for the far lane, 1 for the near lane.
	 */
	static changeLane(dinosaur: Dinosaur, direction: -1 | 1): void {
		const targetLane = dinosaur.targetLane + direction;
		dinosaur.targetLane = Math.min(Math.max(targetLane, 0), GameSettings.LANE_COUNT - 1);
	}

	/**
	 * Makes the dinosaur jump. A dinosaur in the air cannot jump again.
	 * @param dinosaur The dinosaur.
	 * @returns True when the dinosaur jumps.
	 */
	static jump(dinosaur: Dinosaur): boolean {
		if (DinosaurRules.isOnGround(dinosaur) === false) {
			return false;
		}
		dinosaur.verticalSpeed = GameSettings.JUMP_SPEED;
		return true;
	}

	/**
	 * Moves the dinosaur toward its lane, and through its jump, for one step.
	 * @param dinosaur The dinosaur.
	 * @param seconds The duration of the step, in seconds.
	 */
	static step(dinosaur: Dinosaur, seconds: number): void {
		DinosaurRules._stepLane(dinosaur, seconds);
		DinosaurRules._stepJump(dinosaur, seconds);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Moves the lane position of the dinosaur toward its target lane.
	 * @param dinosaur The dinosaur.
	 * @param seconds The duration of the step, in seconds.
	 */
	private static _stepLane(dinosaur: Dinosaur, seconds: number): void {
		const longestMove = seconds / GameSettings.LANE_CHANGE_SECONDS;
		const difference = dinosaur.targetLane - dinosaur.lanePosition;
		if (Math.abs(difference) <= longestMove) {
			dinosaur.lanePosition = dinosaur.targetLane;
			return;
		}
		dinosaur.lanePosition += Math.sign(difference) * longestMove;
	}

	/**
	 * Moves the dinosaur up or down for one step of a jump. The formula is exact for a constant gravity.
	 * @param dinosaur The dinosaur.
	 * @param seconds The duration of the step, in seconds.
	 */
	private static _stepJump(dinosaur: Dinosaur, seconds: number): void {
		if (DinosaurRules.isOnGround(dinosaur) === true) {
			return;
		}
		dinosaur.height += dinosaur.verticalSpeed * seconds - 0.5 * GameSettings.GRAVITY * seconds * seconds;
		dinosaur.verticalSpeed -= GameSettings.GRAVITY * seconds;
		if (dinosaur.height <= 0) {
			dinosaur.height = 0;
			dinosaur.verticalSpeed = 0;
		}
	}
}
