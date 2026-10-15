///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	LaneLayout — where the three lanes are on the screen
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Where the three lanes are on the screen, in design units. The design is 540 units high, and the page scales the
 * bottom part of it to the window: a window that is taller than the design shows more sky. A far lane is higher on
 * the screen and smaller than a near lane, and this is what gives the three lanes their depth.
 */
export class LaneLayout {
	/** The design height of the screen, in design units. The bottom of the window is always at this height. */
	static readonly DESIGN_HEIGHT = 540;

	/** The height of the part of the design that the window always shows, from the bottom, in design units. */
	static readonly VISIBLE_HEIGHT = 450;

	/** The width of the part of the design that the window always shows, from the left, in design units. */
	static readonly VISIBLE_WIDTH = 480;

	/** The place of the dinosaur from the left edge of the screen, in design units. */
	static readonly DINOSAUR_X = 110;

	/** The height of the line where the ground starts, in design units. */
	static readonly GROUND_TOP_Y = 330;

	/** The height of the feet of a thing on each lane, in design units. */
	private static readonly _LANE_BASELINES: readonly number[] = [395, 452, 512];

	/** The scale of the pictures on each lane. */
	private static readonly _LANE_SCALES: readonly number[] = [0.72, 0.86, 1];

	/**
	 * Gives the height of the feet of a thing on a lane. A lane position between two lanes gives a height between them.
	 * @param lanePosition The lane position, from 0 to 2.
	 * @returns The height, in design units.
	 */
	static baseline(lanePosition: number): number {
		const baseline = LaneLayout._interpolate(LaneLayout._LANE_BASELINES, lanePosition);
		return baseline;
	}

	/**
	 * Gives the scale of the pictures on a lane.
	 * @param lanePosition The lane position, from 0 to 2.
	 * @returns The scale. The near lane has the scale 1.
	 */
	static scale(lanePosition: number): number {
		const scale = LaneLayout._interpolate(LaneLayout._LANE_SCALES, lanePosition);
		return scale;
	}

	/**
	 * Gives the place of a thing on the screen, from the left edge. A thing on a far lane moves slower on the screen.
	 * @param x The distance in front of the dinosaur, in units.
	 * @param lanePosition The lane position, from 0 to 2.
	 * @returns The place, in design units.
	 */
	static screenX(x: number, lanePosition: number): number {
		const screenX = LaneLayout.DINOSAUR_X + x * LaneLayout.scale(lanePosition);
		return screenX;
	}

	/**
	 * Gives the height of the line between two lanes.
	 * @param lane The first lane. The line is between this lane and the next lane.
	 * @returns The height, in design units.
	 */
	static boundary(lane: number): number {
		const boundary = (LaneLayout._LANE_BASELINES[lane] + LaneLayout._LANE_BASELINES[lane + 1]) / 2;
		return boundary;
	}

	/**
	 * Reads a value between two entries of a list, from a position.
	 * @param values The values, one for each lane.
	 * @param lanePosition The lane position, from 0 to the last lane.
	 * @returns The value at the position.
	 */
	private static _interpolate(values: readonly number[], lanePosition: number): number {
		const position = Math.min(Math.max(lanePosition, 0), values.length - 1);
		const lowerIndex = Math.min(Math.floor(position), values.length - 2);
		const part = position - lowerIndex;
		const value = values[lowerIndex] + (values[lowerIndex + 1] - values[lowerIndex]) * part;
		return value;
	}
}
