import type { GameCommand } from '../index.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	KeyboardInput — turns the keys into commands of the game
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * What a key asks for: a command of the game, or to turn the sound off or on.
 */
export type KeyboardAction = GameCommand | 'toggleSound';

/**
 * Turns the keys of the keyboard into actions: Space jumps, Arrow Up and Arrow Down change lane, F shoots, Enter starts
 * the game and starts it again, and M turns the sound off or on. A key that stays down gives only one action.
 */
export class KeyboardInput {
	/** The action of each key, by the code of the key. */
	private static readonly _ACTIONS: ReadonlyMap<string, KeyboardAction> = new Map<string, KeyboardAction>([
		['Space', 'jump'],
		['ArrowUp', 'laneUp'],
		['ArrowDown', 'laneDown'],
		['KeyF', 'shoot'],
		['Enter', 'start'],
		['KeyM', 'toggleSound'],
	]);

	/**
	 * Starts to listen to the keys.
	 * @param target The window that receives the keys.
	 * @param onAction The function that receives each action.
	 */
	static attach(target: Window, onAction: (action: KeyboardAction) => void): void {
		target.addEventListener('keydown', (event: KeyboardEvent) => {
			const action = KeyboardInput._ACTIONS.get(event.code);
			if (action === undefined) {
				return;
			}
			event.preventDefault();
			if (event.repeat === true) {
				return;
			}
			onAction(action);
		});
	}
}
