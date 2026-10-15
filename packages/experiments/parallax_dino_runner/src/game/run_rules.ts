import { GameSettings } from './game_settings.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	RunRules — the speed of the world and the score of a run
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The rules of a run: the world goes faster and faster with the distance, and the distance gives the score.
 */
export class RunRules {
	/**
	 * Gives the speed of the world at a distance. The speed grows with the distance up to a maximum.
	 * @param distance The distance that the world went through, in units.
	 * @returns The speed, in units per second.
	 */
	static speedAt(distance: number): number {
		const speed = Math.min(
			GameSettings.MAX_SPEED,
			GameSettings.START_SPEED + GameSettings.SPEED_GAIN_PER_UNIT * distance,
		);
		return speed;
	}

	/**
	 * Gives the score of a run.
	 * @param distance The distance that the world went through, in units.
	 * @returns The score, as a whole number.
	 */
	static score(distance: number): number {
		const score = Math.floor(distance / GameSettings.UNITS_PER_SCORE_POINT);
		return score;
	}
}
