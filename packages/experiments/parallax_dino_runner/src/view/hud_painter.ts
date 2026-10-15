import type { GameState } from '../index.ts';
import { CommitRules, GameSettings, RunRules } from '../index.ts';
import { ViewPalette } from './view_palette.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HudPainter — the counter of ammunition, the score, and the messages
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the information on top of the game: the counter of ammunition, the score, the bar of the next commit, and the
 * messages of the phases "ready", "paused", "over", and "finished".
 */
export class HudPainter {
	/** The font of the texts. */
	private static readonly _FONT = 'monospace';

	/** The height of the top of the message of the phase "paused", in design units. It is under the commit bar. */
	private static readonly _PAUSED_PANEL_TOP = 138;

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
	 * Draws the bar of the next commit in front of the dinosaur, under the counters: the subject, the date, the start
	 * of the hash, the lines added and deleted, and the word "merge" for a merge commit. The bar stays while the game
	 * is paused. Nothing is drawn in the other phases, or when no commit is in front of the dinosaur.
	 * @param context The drawing context of the canvas.
	 * @param gameState The state of the game.
	 * @param designWidth The width of the window, in design units.
	 */
	static paintCommitBar(context: CanvasRenderingContext2D, gameState: GameState, designWidth: number): void {
		const thing = CommitRules.nextAhead(gameState);
		const isShown = gameState.phase === 'running' || gameState.phase === 'paused';
		if (isShown === false || thing === null || thing.commit === null) {
			return;
		}
		const commit = thing.commit;
		const barWidth = Math.min(460, designWidth - 48);
		const left = (designWidth - barWidth) / 2;
		const top = 72;
		context.fillStyle = ViewPalette.PANEL;
		context.beginPath();
		context.roundRect(left, top, barWidth, 50, 10);
		context.fill();
		context.fillStyle = ViewPalette.TEXT;
		context.textAlign = 'left';
		context.textBaseline = 'alphabetic';
		context.font = `bold 15px ${HudPainter._FONT}`;
		context.fillText(HudPainter._fitText(context, commit.subject, barWidth - 28), left + 14, top + 21);
		context.globalAlpha = 0.7;
		context.font = `13px ${HudPainter._FONT}`;
		const date = commit.committedAt.slice(0, 10);
		const mergeText = commit.isMerge === true ? '   merge' : '';
		const hash = commit.hash.slice(0, 7);
		const detailText = `${date}   ${hash}   +${commit.insertions} -${commit.deletions}${mergeText}`;
		context.fillText(detailText, left + 14, top + 40);
		context.globalAlpha = 1;
	}

	/**
	 * Draws the message of the phase "ready", "paused", "over", or "finished" in the middle of the window.
	 * @param context The drawing context of the canvas.
	 * @param gameState The state of the game.
	 * @param designWidth The width of the window, in design units.
	 * @param designHeight The height of the window, in design units.
	 * @param notice A text for the player that the phase "ready" shows under the keys, or null.
	 */
	static paintMessage(
		context: CanvasRenderingContext2D,
		gameState: GameState,
		designWidth: number,
		designHeight: number,
		notice: string | null,
	): void {
		if (gameState.phase === 'running') {
			return;
		}
		const score = RunRules.score(gameState.distance);
		let lines: string[];
		if (gameState.phase === 'ready') {
			lines = [
				'PARALLAX DINO RUNNER',
				'Press Enter to start',
				'Space: jump     F: shoot',
				'Arrow up, arrow down: change lane',
				'P: pause     M: sound on or off',
			];
			if (notice !== null) {
				lines.push(notice);
			}
		} else if (gameState.phase === 'paused') {
			lines = ['PAUSED', 'Press P to continue'];
		} else if (gameState.phase === 'finished') {
			lines = ['NEWEST COMMIT REACHED', `Score ${score}`, 'Press Enter to play again'];
		} else {
			lines = ['GAME OVER', `Score ${score}`, 'Press Enter to play again'];
		}
		const panelWidth = 370;
		const panelHeight = 52 + lines.length * 25;
		const left = (designWidth - panelWidth) / 2;
		const top = gameState.phase === 'paused' ? HudPainter._PAUSED_PANEL_TOP : Math.max(60, designHeight * 0.14);
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

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Cuts a text that is too long for a width, and ends it with three dots. The font of the context must be set.
	 * @param context The drawing context of the canvas.
	 * @param text The text.
	 * @param maxWidth The largest width of the text, in design units.
	 * @returns The text, or the cut text.
	 */
	private static _fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
		if (context.measureText(text).width <= maxWidth) {
			return text;
		}
		let length = text.length;
		while (length > 1 && context.measureText(`${text.slice(0, length)}...`).width > maxWidth) {
			length -= 1;
		}
		return `${text.slice(0, length)}...`;
	}
}
