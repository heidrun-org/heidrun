import type { GameState } from '../index.ts';
import { GameSettings, RunRules } from '../index.ts';
import { ViewPalette } from './view_palette.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HudPainter — the counter of ammunition, the score, and the messages
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the information on top of the game: the counter of ammunition, the score, and the messages of the phases
 * "ready" and "over".
 */
export class HudPainter {
	/** The font of the texts. */
	private static readonly _FONT = 'monospace';

	/**
	 * Draws the counter of ammunition and the score.
	 * @param context The drawing context of the canvas.
	 * @param gameState The state of the game.
	 * @param designWidth The width of the window, in design units.
	 */
	static paintCounters(context: CanvasRenderingContext2D, gameState: GameState, designWidth: number): void {
		context.fillStyle = ViewPalette.TEXT;
		context.textBaseline = 'alphabetic';
		context.textAlign = 'left';
		context.font = `bold 14px ${HudPainter._FONT}`;
		context.fillText('SHOTS', 24, 34);
		for (let index = 0; index < GameSettings.MAX_AMMUNITION; index += 1) {
			context.fillStyle = index < gameState.ammunition ? ViewPalette.BULLET : ViewPalette.AMMUNITION_EMPTY;
			context.beginPath();
			context.roundRect(24 + index * 16, 42, 10, 18, 4);
			context.fill();
		}

		const score = RunRules.score(gameState.distance);
		const scoreText = String(score).padStart(5, '0');
		const bestText = String(gameState.bestScore).padStart(5, '0');
		context.fillStyle = ViewPalette.TEXT;
		context.textAlign = 'right';
		context.font = `bold 22px ${HudPainter._FONT}`;
		context.fillText(scoreText, designWidth - 24, 34);
		if (gameState.bestScore > 0) {
			context.globalAlpha = 0.55;
			context.font = `bold 16px ${HudPainter._FONT}`;
			context.fillText(`BEST ${bestText}`, designWidth - 24, 58);
			context.globalAlpha = 1;
		}
	}

	/**
	 * Draws the message of the phase "ready" or of the phase "over" in the middle of the window.
	 * @param context The drawing context of the canvas.
	 * @param gameState The state of the game.
	 * @param designWidth The width of the window, in design units.
	 * @param designHeight The height of the window, in design units.
	 */
	static paintMessage(
		context: CanvasRenderingContext2D,
		gameState: GameState,
		designWidth: number,
		designHeight: number,
	): void {
		if (gameState.phase === 'running') {
			return;
		}
		const lines =
			gameState.phase === 'ready'
				? [
						'PARALLAX DINO RUNNER',
						'Press Enter to start',
						'Space: jump     F: shoot     M: sound',
						'Arrow up, arrow down: change lane',
					]
				: ['GAME OVER', `Score ${RunRules.score(gameState.distance)}`, 'Press Enter to play again'];
		const panelWidth = 370;
		const panelHeight = 52 + lines.length * 25;
		const left = (designWidth - panelWidth) / 2;
		const top = Math.max(60, designHeight * 0.14);
		context.fillStyle = ViewPalette.PANEL;
		context.beginPath();
		context.roundRect(left, top, panelWidth, panelHeight, 14);
		context.fill();
		context.fillStyle = ViewPalette.TEXT;
		context.textAlign = 'center';
		for (let index = 0; index < lines.length; index += 1) {
			context.font = index === 0 ? `bold 22px ${HudPainter._FONT}` : `15px ${HudPainter._FONT}`;
			context.fillText(lines[index], designWidth / 2, top + 40 + index * 25);
		}
	}
}
