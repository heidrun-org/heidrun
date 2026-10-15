import type { GameState } from '../index.ts';
import { GameSettings } from '../index.ts';
import { BackdropPainter } from './backdrop_painter.ts';
import { DinosaurPainter } from './dinosaur_painter.ts';
import { GroundPainter } from './ground_painter.ts';
import { HudPainter } from './hud_painter.ts';
import { LaneLayout } from './lane_layout.ts';
import { ThingPainter } from './thing_painter.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SceneRenderer — draws one whole picture of the game
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws one whole picture of the game, from back to front: the sky, the clouds, the mountains, the hills, the ground,
 * then the lanes from the far lane to the near lane, and last the counters and the messages. The picture is scaled
 * so that its design height fits the window.
 */
export class SceneRenderer {
	/**
	 * Draws one picture.
	 * @param context The drawing context of the canvas.
	 * @param gameState The state of the game.
	 * @param pixelWidth The width of the canvas, in pixels of the screen.
	 * @param pixelHeight The height of the canvas, in pixels of the screen.
	 */
	static render(
		context: CanvasRenderingContext2D,
		gameState: GameState,
		pixelWidth: number,
		pixelHeight: number,
	): void {
		const scale = Math.min(pixelHeight / LaneLayout.VISIBLE_HEIGHT, pixelWidth / LaneLayout.VISIBLE_WIDTH);
		const designWidth = pixelWidth / scale;
		const designHeight = pixelHeight / scale;
		const extraTop = designHeight - LaneLayout.DESIGN_HEIGHT;

		context.save();
		context.setTransform(scale, 0, 0, scale, 0, 0);
		BackdropPainter.paintSky(context, designWidth, designHeight);

		context.save();
		context.translate(0, extraTop);
		BackdropPainter.paintLayers(context, gameState.distance, designWidth);
		GroundPainter.paint(context, gameState.distance, designWidth);
		for (let lane = 0; lane < GameSettings.LANE_COUNT; lane += 1) {
			SceneRenderer._paintLane(context, gameState, lane);
		}
		context.restore();

		HudPainter.paintCounters(context, gameState, designWidth);
		HudPainter.paintMessage(context, gameState, designWidth, designHeight);
		context.restore();
	}

	/**
	 * Draws everything of one lane: the things, the pieces, the shots, and the dinosaur when it is in this lane.
	 * @param context The drawing context of the canvas.
	 * @param gameState The state of the game.
	 * @param lane The lane.
	 */
	private static _paintLane(context: CanvasRenderingContext2D, gameState: GameState, lane: number): void {
		const things = gameState.things
			.filter((thing) => thing.lane === lane)
			.sort((first, second) => second.x - first.x);
		for (const thing of things) {
			ThingPainter.paintThing(context, thing);
		}
		for (const piece of gameState.pieces) {
			if (piece.lane === lane) {
				ThingPainter.paintPiece(context, piece);
			}
		}
		for (const bullet of gameState.bullets) {
			if (bullet.lane === lane) {
				ThingPainter.paintBullet(context, bullet);
			}
		}
		if (Math.round(gameState.dinosaur.lanePosition) === lane) {
			DinosaurPainter.paint(context, gameState);
		}
	}
}
