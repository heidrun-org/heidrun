import type { Bullet, Piece, Thing } from '../index.ts';
import { LaneLayout } from './lane_layout.ts';
import { PixelSprites } from './pixel_sprites.ts';
import { SpriteFrames } from './sprite_frames.ts';
import { ViewPalette } from './view_palette.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ThingPainter — the cacti, the rocks, the crates, the shots, and the pieces of rock
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the things that stand in the lanes, the shots, and the pieces of broken rocks. A thing on a far lane is
 * smaller, and it stands higher on the screen.
 */
export class ThingPainter {
	/** The outline of a rock: the places of the points, as a part of the width and of the height of the rock. */
	private static readonly _ROCK_OUTLINE: readonly (readonly [number, number])[] = [
		[-0.5, 0],
		[-0.52, -0.35],
		[-0.38, -0.72],
		[-0.12, -0.97],
		[0.16, -1],
		[0.4, -0.78],
		[0.52, -0.4],
		[0.5, 0],
	];

	/**
	 * Draws one thing.
	 * @param context The drawing context of the canvas.
	 * @param thing The thing.
	 */
	static paintThing(context: CanvasRenderingContext2D, thing: Thing): void {
		const scale = LaneLayout.scale(thing.lane);
		const baseline = LaneLayout.baseline(thing.lane);
		const screenX = LaneLayout.screenX(thing.x, thing.lane);
		ThingPainter._paintShadow(context, screenX, baseline, thing.width * 0.55 * scale);
		if (thing.kind === 'cactus') {
			ThingPainter._paintCactus(context, screenX, baseline, scale);
		} else if (thing.kind === 'rock') {
			ThingPainter._paintRock(context, thing, screenX, baseline, scale);
		} else {
			ThingPainter._paintCrate(context, thing, screenX, baseline, scale);
		}
	}

	/**
	 * Draws one shot: a short orange streak with a light middle and a tail.
	 * @param context The drawing context of the canvas.
	 * @param bullet The shot.
	 */
	static paintBullet(context: CanvasRenderingContext2D, bullet: Bullet): void {
		const scale = LaneLayout.scale(bullet.lane);
		const screenX = LaneLayout.screenX(bullet.x, bullet.lane);
		const y = LaneLayout.baseline(bullet.lane) - 40 * scale;
		context.fillStyle = 'rgba(255, 140, 26, 0.35)';
		context.fillRect(screenX - 46 * scale, y - 2 * scale, 36 * scale, 4 * scale);
		context.fillStyle = ViewPalette.BULLET;
		context.beginPath();
		context.ellipse(screenX, y, 11 * scale, 5 * scale, 0, 0, Math.PI * 2);
		context.fill();
		context.fillStyle = ViewPalette.BULLET_CORE;
		context.beginPath();
		context.ellipse(screenX + 2 * scale, y, 5 * scale, 2.5 * scale, 0, 0, Math.PI * 2);
		context.fill();
	}

	/**
	 * Draws one piece of a broken rock.
	 * @param context The drawing context of the canvas.
	 * @param piece The piece.
	 */
	static paintPiece(context: CanvasRenderingContext2D, piece: Piece): void {
		const scale = LaneLayout.scale(piece.lane);
		const screenX = LaneLayout.screenX(piece.x, piece.lane);
		const y = LaneLayout.baseline(piece.lane) - piece.height * scale;
		const size = piece.size * scale;
		context.fillStyle = piece.id % 2 === 0 ? ViewPalette.ROCK : ViewPalette.ROCK_DARK;
		context.fillRect(screenX - size / 2, y - size, size, size);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Draws the shadow under a thing.
	 * @param context The drawing context of the canvas.
	 * @param screenX The place of the middle of the thing, in design units.
	 * @param baseline The height of the feet of the thing, in design units.
	 * @param radius The half width of the shadow, in design units.
	 */
	private static _paintShadow(
		context: CanvasRenderingContext2D,
		screenX: number,
		baseline: number,
		radius: number,
	): void {
		context.fillStyle = ViewPalette.SHADOW;
		context.beginPath();
		context.ellipse(screenX, baseline + 2, radius, radius * 0.22, 0, 0, Math.PI * 2);
		context.fill();
	}

	/**
	 * Draws a cactus.
	 * @param context The drawing context of the canvas.
	 * @param screenX The place of the middle of the cactus, in design units.
	 * @param baseline The height of the feet of the cactus, in design units.
	 * @param scale The scale of the lane.
	 */
	private static _paintCactus(
		context: CanvasRenderingContext2D,
		screenX: number,
		baseline: number,
		scale: number,
	): void {
		const cell = SpriteFrames.CELL * scale;
		const left = screenX - (SpriteFrames.CACTUS_COLUMNS * cell) / 2;
		const top = baseline - SpriteFrames.CACTUS.length * cell;
		PixelSprites.draw(context, SpriteFrames.CACTUS, ViewPalette.CACTUS_PIXELS, left, top, cell);
	}

	/**
	 * Gives a number between 0 and 1 that stays the same for the same rock and the same point.
	 * @param id The number of the rock.
	 * @param pointIndex The number of the point of the outline.
	 * @returns The number.
	 */
	private static _jitter(id: number, pointIndex: number): number {
		const value = Math.sin(id * 12.9898 + pointIndex * 78.233) * 43758.5453;
		const jitter = value - Math.floor(value);
		return jitter;
	}

	/**
	 * Draws a rock: a dark edge, a lighter middle, and a lit spot at the top left. The outline is a little different
	 * for each rock.
	 * @param context The drawing context of the canvas.
	 * @param thing The rock.
	 * @param screenX The place of the middle of the rock, in design units.
	 * @param baseline The height of the feet of the rock, in design units.
	 * @param scale The scale of the lane.
	 */
	private static _paintRock(
		context: CanvasRenderingContext2D,
		thing: Thing,
		screenX: number,
		baseline: number,
		scale: number,
	): void {
		const width = thing.width * scale;
		const height = thing.height * scale;
		context.save();
		context.translate(screenX, baseline);
		ThingPainter._outlinePath(context, thing.id, width, height);
		context.fillStyle = ViewPalette.ROCK_DARK;
		context.fill();

		context.save();
		context.translate(-width * 0.03, 0);
		context.scale(0.9, 0.93);
		ThingPainter._outlinePath(context, thing.id, width, height);
		context.fillStyle = ViewPalette.ROCK;
		context.fill();
		context.restore();

		context.save();
		context.translate(-width * 0.12, -height * 0.18);
		context.scale(0.5, 0.5);
		ThingPainter._outlinePath(context, thing.id, width, height);
		context.fillStyle = ViewPalette.ROCK_LIGHT;
		context.fill();
		context.restore();
		context.restore();
	}

	/**
	 * Makes the path of the outline of a rock. The bottom of the rock is on the line y = 0.
	 * @param context The drawing context of the canvas.
	 * @param id The number of the rock, which makes the outline different for each rock.
	 * @param width The width of the rock, in design units.
	 * @param height The height of the rock, in design units.
	 */
	private static _outlinePath(context: CanvasRenderingContext2D, id: number, width: number, height: number): void {
		context.beginPath();
		for (let pointIndex = 0; pointIndex < ThingPainter._ROCK_OUTLINE.length; pointIndex += 1) {
			const [partX, partY] = ThingPainter._ROCK_OUTLINE[pointIndex];
			const isOnGround = partY === 0;
			const jitterX = isOnGround ? 0 : (ThingPainter._jitter(id, pointIndex) - 0.5) * 0.08;
			const jitterY = isOnGround ? 0 : (ThingPainter._jitter(id, pointIndex + 20) - 0.5) * 0.1;
			const x = (partX + jitterX) * width;
			const y = (partY + jitterY) * height;
			if (pointIndex === 0) {
				context.moveTo(x, y);
			} else {
				context.lineTo(x, y);
			}
		}
		context.closePath();
	}

	/**
	 * Draws a crate of ammunition: a wooden box with a cross and a shot in the middle.
	 * @param context The drawing context of the canvas.
	 * @param thing The crate.
	 * @param screenX The place of the middle of the crate, in design units.
	 * @param baseline The height of the feet of the crate, in design units.
	 * @param scale The scale of the lane.
	 */
	private static _paintCrate(
		context: CanvasRenderingContext2D,
		thing: Thing,
		screenX: number,
		baseline: number,
		scale: number,
	): void {
		const width = thing.width * scale;
		const height = thing.height * scale;
		const left = screenX - width / 2;
		const top = baseline - height;
		context.fillStyle = ViewPalette.CRATE;
		context.fillRect(left, top, width, height);
		context.strokeStyle = ViewPalette.CRATE_DARK;
		context.lineWidth = 3 * scale;
		context.strokeRect(left + 1.5 * scale, top + 1.5 * scale, width - 3 * scale, height - 3 * scale);
		context.beginPath();
		context.moveTo(left, top);
		context.lineTo(left + width, top + height);
		context.moveTo(left + width, top);
		context.lineTo(left, top + height);
		context.lineWidth = 2 * scale;
		context.stroke();
		context.fillStyle = ViewPalette.BULLET;
		context.beginPath();
		context.ellipse(screenX, top + height / 2, 7 * scale, 4 * scale, 0, 0, Math.PI * 2);
		context.fill();
	}
}
