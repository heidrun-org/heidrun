import { GameSettings, ParallaxRules } from '../index.ts';
import { LaneLayout } from './lane_layout.ts';
import { ViewPalette } from './view_palette.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GroundPainter — the ground with its three lanes
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the ground: three bands, one for each lane, with the lines between the lanes and the marks that move toward
 * the left. The marks of a far lane move slower than the marks of a near lane, as the things of that lane do.
 */
export class GroundPainter {
	/** The distance between two marks on the near lane, in design units. */
	private static readonly _MARK_PERIOD = 140;

	/** The length of one mark on the near lane, in design units. */
	private static readonly _MARK_LENGTH = 46;

	/**
	 * Draws the three bands, the lines, and the marks.
	 * @param context The drawing context of the canvas.
	 * @param distance The distance that the ground went through, in units.
	 * @param designWidth The width of the window, in design units.
	 */
	static paint(context: CanvasRenderingContext2D, distance: number, designWidth: number): void {
		const bottom = LaneLayout.DESIGN_HEIGHT + 2;
		const firstBoundary = LaneLayout.boundary(0);
		const secondBoundary = LaneLayout.boundary(1);
		context.fillStyle = ViewPalette.GROUND_FAR;
		context.fillRect(0, LaneLayout.GROUND_TOP_Y, designWidth, firstBoundary - LaneLayout.GROUND_TOP_Y);
		context.fillStyle = ViewPalette.GROUND_MIDDLE;
		context.fillRect(0, firstBoundary, designWidth, secondBoundary - firstBoundary);
		context.fillStyle = ViewPalette.GROUND_NEAR;
		context.fillRect(0, secondBoundary, designWidth, bottom - secondBoundary);

		context.fillStyle = ViewPalette.GROUND_MARK;
		context.fillRect(0, LaneLayout.GROUND_TOP_Y, designWidth, 2);
		context.fillRect(0, firstBoundary - 1, designWidth, 2);
		context.fillRect(0, secondBoundary - 1, designWidth, 2);

		for (let lane = 0; lane < GameSettings.LANE_COUNT; lane += 1) {
			GroundPainter._paintMarks(context, distance, designWidth, lane);
		}
	}

	/**
	 * Draws the marks of one lane.
	 * @param context The drawing context of the canvas.
	 * @param distance The distance that the ground went through, in units.
	 * @param designWidth The width of the window, in design units.
	 * @param lane The lane.
	 */
	private static _paintMarks(
		context: CanvasRenderingContext2D,
		distance: number,
		designWidth: number,
		lane: number,
	): void {
		const scale = LaneLayout.scale(lane);
		const period = GroundPainter._MARK_PERIOD * scale;
		const offset = ParallaxRules.layerOffset(distance, GameSettings.PARALLAX_GROUND * scale, period);
		const y = LaneLayout.baseline(lane) + 12 * scale;
		context.fillStyle = ViewPalette.GROUND_MARK;
		for (let x = -offset; x < designWidth; x += period) {
			context.fillRect(x, y, GroundPainter._MARK_LENGTH * scale, 3 * scale);
			context.fillRect(x + period * 0.55, y + 9 * scale, 14 * scale, 2 * scale);
		}
	}
}
