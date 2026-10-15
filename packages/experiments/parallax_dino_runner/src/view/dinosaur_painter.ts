import type { GameState } from '../index.ts';
import { DinosaurRules } from '../index.ts';
import { LaneLayout } from './lane_layout.ts';
import { PixelSprites } from './pixel_sprites.ts';
import { SpriteFrames } from './sprite_frames.ts';
import { ViewPalette } from './view_palette.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DinosaurPainter — the dinosaur and its shadow
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the dinosaur. The dinosaur always stands at the same place on the screen, and its lane gives its height on the
 * screen and its size. The legs run while the world runs, and the shadow gets smaller when the dinosaur jumps.
 */
export class DinosaurPainter {
	/** The distance of the ground between two changes of the picture of the run, in units. */
	private static readonly _RUN_FRAME_DISTANCE = 40;

	/**
	 * Draws the dinosaur.
	 * @param context The drawing context of the canvas.
	 * @param gameState The state of the game.
	 */
	static paint(context: CanvasRenderingContext2D, gameState: GameState): void {
		const dinosaur = gameState.dinosaur;
		const scale = LaneLayout.scale(dinosaur.lanePosition);
		const baseline = LaneLayout.baseline(dinosaur.lanePosition);
		const cell = SpriteFrames.CELL * scale;

		const shadowRadius = 26 * scale * Math.max(0.4, 1 - dinosaur.height / 260);
		context.fillStyle = ViewPalette.SHADOW;
		context.beginPath();
		context.ellipse(LaneLayout.DINOSAUR_X, baseline + 2, shadowRadius, shadowRadius * 0.22, 0, 0, Math.PI * 2);
		context.fill();

		const left = LaneLayout.DINOSAUR_X - SpriteFrames.DINOSAUR_CENTER_COLUMN * cell;
		const top = baseline - dinosaur.height * scale - SpriteFrames.DINOSAUR_ROWS * cell;
		const frame = DinosaurPainter._chooseFrame(gameState);
		PixelSprites.draw(context, frame, ViewPalette.DINOSAUR_PIXELS, left, top, cell);
	}

	/**
	 * Chooses the picture of the dinosaur: dead after a hit, standing before the start and in the air, and running
	 * with the legs in turn on the ground.
	 * @param gameState The state of the game.
	 * @returns The rows of the picture.
	 */
	private static _chooseFrame(gameState: GameState): readonly string[] {
		if (gameState.phase === 'over') {
			return SpriteFrames.DINOSAUR_HIT;
		}
		if (gameState.phase === 'ready' || DinosaurRules.isOnGround(gameState.dinosaur) === false) {
			return SpriteFrames.DINOSAUR_STAND;
		}
		const frameIndex = Math.floor(gameState.distance / DinosaurPainter._RUN_FRAME_DISTANCE) % 2;
		return frameIndex === 0 ? SpriteFrames.DINOSAUR_RUN_A : SpriteFrames.DINOSAUR_RUN_B;
	}
}
