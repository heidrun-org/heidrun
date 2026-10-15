import { GameSettings, ParallaxRules } from '../index.ts';
import { LaneLayout } from './lane_layout.ts';
import { ViewPalette } from './view_palette.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	BackdropPainter — the sky, the clouds, the far mountains, and the near hills
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The look of one ridge layer: a layer whose top edge is the sum of a few sine waves.
 */
type RidgeLook = {
	/** The color of the ridge. */
	color: string;
	/** How far the layer moved to the left, in design units. */
	offset: number;
	/** The width of the repeated picture, in design units. */
	tile: number;
	/** The width of the window, in design units. */
	designWidth: number;
	/** The height of the ridge without the waves, in design units. */
	baseHeight: number;
	/** The waves: the number of periods in the picture, the height, and the phase. */
	waves: readonly (readonly [number, number, number])[];
};

/**
 * Draws the three parallax layers behind the ground: the sky with its clouds, the far mountains, and the near hills.
 * Each layer repeats a picture of a fixed width and moves at its own part of the speed of the ground.
 */
export class BackdropPainter {
	/** The width of the repeated picture of the clouds, in design units. */
	private static readonly _CLOUD_TILE = 1600;

	/** The width of the repeated picture of the mountains, in design units. */
	private static readonly _MOUNTAIN_TILE = 1500;

	/** The width of the repeated picture of the hills, in design units. */
	private static readonly _HILL_TILE = 1000;

	/** The clouds of one picture: the left edge, the height, and the width of each cloud. */
	private static readonly _CLOUDS: readonly (readonly [number, number, number])[] = [
		[100, 205, 90],
		[430, 60, 70],
		[520, 245, 70],
		[820, 120, 90],
		[900, 215, 110],
		[1250, 70, 100],
		[1300, 250, 80],
	];

	/**
	 * Draws the sky over the whole window. Call it before the translation that puts the ground at the bottom.
	 * @param context The drawing context of the canvas.
	 * @param designWidth The width of the window, in design units.
	 * @param designHeight The height of the window, in design units.
	 */
	static paintSky(context: CanvasRenderingContext2D, designWidth: number, designHeight: number): void {
		const gradient = context.createLinearGradient(0, 0, 0, designHeight);
		gradient.addColorStop(0, ViewPalette.SKY_TOP);
		gradient.addColorStop(1, ViewPalette.SKY_BOTTOM);
		context.fillStyle = gradient;
		context.fillRect(0, 0, designWidth, designHeight);
	}

	/**
	 * Draws the clouds, the far mountains, and the near hills.
	 * @param context The drawing context of the canvas.
	 * @param distance The distance that the ground went through, in units.
	 * @param designWidth The width of the window, in design units.
	 */
	static paintLayers(context: CanvasRenderingContext2D, distance: number, designWidth: number): void {
		BackdropPainter._paintClouds(context, distance, designWidth);
		const mountainTile = BackdropPainter._MOUNTAIN_TILE;
		BackdropPainter._paintRidge(context, {
			color: ViewPalette.MOUNTAINS,
			offset: ParallaxRules.layerOffset(distance, GameSettings.PARALLAX_MOUNTAINS, mountainTile),
			tile: mountainTile,
			designWidth,
			baseHeight: 74,
			waves: [
				[1, 30, 0.5],
				[3, 18, 1.7],
				[7, 8, 0.3],
			],
		});
		BackdropPainter._paintRidge(context, {
			color: ViewPalette.HILLS,
			offset: ParallaxRules.layerOffset(distance, GameSettings.PARALLAX_HILLS, BackdropPainter._HILL_TILE),
			tile: BackdropPainter._HILL_TILE,
			designWidth,
			baseHeight: 36,
			waves: [
				[2, 18, 1],
				[5, 8, 2],
			],
		});
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Draws the clouds. Each cloud is three overlapping ellipses.
	 * @param context The drawing context of the canvas.
	 * @param distance The distance that the ground went through, in units.
	 * @param designWidth The width of the window, in design units.
	 */
	private static _paintClouds(context: CanvasRenderingContext2D, distance: number, designWidth: number): void {
		const offset = ParallaxRules.layerOffset(distance, GameSettings.PARALLAX_SKY, BackdropPainter._CLOUD_TILE);
		context.fillStyle = ViewPalette.CLOUD;
		for (let tileIndex = -1; tileIndex <= Math.ceil(designWidth / BackdropPainter._CLOUD_TILE); tileIndex += 1) {
			for (const [left, top, width] of BackdropPainter._CLOUDS) {
				const x = left + tileIndex * BackdropPainter._CLOUD_TILE - offset;
				context.beginPath();
				context.ellipse(x + width * 0.5, top + 14, width * 0.5, 14, 0, 0, Math.PI * 2);
				context.ellipse(x + width * 0.32, top + 8, width * 0.22, 14, 0, 0, Math.PI * 2);
				context.ellipse(x + width * 0.62, top + 4, width * 0.26, 15, 0, 0, Math.PI * 2);
				context.fill();
			}
		}
	}

	/**
	 * Draws a ridge: a layer whose top edge is the sum of a few sine waves, so that it repeats exactly.
	 * @param context The drawing context of the canvas.
	 * @param ridge The look of the ridge: the color, the offset, the width of the picture, the height of its base, and
	 * the waves. A wave is the number of periods in the picture, its height, and its phase.
	 */
	private static _paintRidge(context: CanvasRenderingContext2D, ridge: RidgeLook): void {
		context.fillStyle = ridge.color;
		context.beginPath();
		context.moveTo(0, LaneLayout.GROUND_TOP_Y + 4);
		for (let screenX = 0; screenX <= ridge.designWidth + 10; screenX += 10) {
			const pictureX = screenX + ridge.offset;
			let height = ridge.baseHeight;
			for (const [periods, waveHeight, phase] of ridge.waves) {
				height += waveHeight * Math.sin((2 * Math.PI * periods * pictureX) / ridge.tile + phase);
			}
			context.lineTo(screenX, LaneLayout.GROUND_TOP_Y - height);
		}
		context.lineTo(ridge.designWidth + 10, LaneLayout.GROUND_TOP_Y + 4);
		context.closePath();
		context.fill();
	}
}
