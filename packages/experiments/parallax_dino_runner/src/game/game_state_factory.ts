import { DinosaurRules } from './dinosaur_rules.ts';
import { GameSettings } from './game_settings.ts';
import type { GameState } from './game_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GameStateFactory — makes the state of a new run
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Makes the state of a new run: the dinosaur in the middle lane, no thing, and the first ammunition.
 */
export class GameStateFactory {
	/**
	 * Makes the state of a new run in the phase "ready".
	 * @param bestScore The best score of the earlier runs of this page.
	 * @returns The new state.
	 */
	static create(bestScore: number): GameState {
		const gameState: GameState = {
			phase: 'ready',
			dinosaur: DinosaurRules.create(),
			things: [],
			bullets: [],
			pieces: [],
			distance: 0,
			speed: GameSettings.START_SPEED,
			lastCommitX: null,
			ammunition: GameSettings.START_AMMUNITION,
			bestScore,
			nextId: 1,
			events: [],
		};
		return gameState;
	}
}
