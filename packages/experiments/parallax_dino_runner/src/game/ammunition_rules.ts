import { GameSettings } from './game_settings.ts';
import type { GameState } from './game_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AmmunitionRules — the number of shots that the player has
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The rules of the ammunition: a shot uses one unit, and a crate adds units up to a maximum.
 */
export class AmmunitionRules {
	/**
	 * Uses one unit of ammunition.
	 * @param gameState The state of the game.
	 * @returns True when the player had a unit to use.
	 */
	static spend(gameState: GameState): boolean {
		if (gameState.ammunition <= 0) {
			return false;
		}
		gameState.ammunition -= 1;
		return true;
	}

	/**
	 * Adds the ammunition of one crate. The player never has more than the maximum.
	 * @param gameState The state of the game.
	 */
	static addCrate(gameState: GameState): void {
		const ammunition = gameState.ammunition + GameSettings.CRATE_AMMUNITION;
		gameState.ammunition = Math.min(ammunition, GameSettings.MAX_AMMUNITION);
	}
}
