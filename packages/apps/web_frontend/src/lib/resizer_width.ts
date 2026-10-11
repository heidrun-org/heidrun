///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ResizerWidth — keeps the width of a column of the window between its limits
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The limits of the width of one column of the window. */
export type ResizerWidthLimits = {
	/** The smallest width of the column, in pixels. */
	min: number;
	/** The largest width of the column, in pixels. */
	max: number;
	/** The width, in pixels, that the other columns of the window take. */
	reserve: number;
};

/** The width that the middle of the window keeps at least, in pixels. */
const CENTER_MIN_WIDTH = 420;

/** The width limits of the columns of the window that the user can drag. */
export class ResizerWidth {
	/**
	 * Keeps a width between the limits of its column. The middle of the window never gets narrower than 420 pixels.
	 *
	 * @param width - The wanted width, in pixels.
	 * @param limits - The limits of the column.
	 * @param windowWidth - The width of the window, in pixels.
	 * @returns The width to use, as a whole number of pixels.
	 */
	static clamp(width: number, limits: ResizerWidthLimits, windowWidth: number): number {
		const roomLeft = windowWidth - CENTER_MIN_WIDTH - limits.reserve;
		return Math.round(Math.min(limits.max, roomLeft, Math.max(limits.min, width)));
	}
}
