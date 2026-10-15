///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivityTooltipPlacement — finds the column of a slot in the histogram, and places its tooltip beside the column
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The side of the column where the tooltip sits: at the end of the column (the right side), or at its start (the left). */
export type UserActivityTooltipSide = "start" | "end";

/** Where the tooltip touches the column of a slot. */
export type UserActivityColumnEdge = {
	/** The side of the column where the tooltip sits. */
	side: UserActivityTooltipSide;
	/** The distance from the left side of the chart to the edge of the column that the tooltip touches, in pixels. */
	edge: number;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Constants
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The margins around the plotting area of the histogram, in pixels. The chart and the tooltip use the same margins. */
export const USER_ACTIVITY_CHART_MARGIN = {
	t: 72,
	r: 40,
	b: 64,
	l: 64,
};

/** The share of the width of a slot that stays empty between two columns. The chart and the tooltip use the same share. */
export const USER_ACTIVITY_BAR_GAP = 0.15;

/** The width of the arrow of the tooltip along the side of the tooltip, in pixels: 1.5 rem at the default font size. */
const ARROW_WIDTH = 24;

/** The least space between the arrow and the corner of the tooltip, in pixels. */
const ARROW_CORNER_SPACE = 8;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivityTooltipPlacement
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The geometry of the tooltip of a column of the histogram. The tooltip sits beside the column, with an arrow that points to
 * the column, at the height of the pointer. The margins of the chart are fixed, so the place of a column follows from its
 * index, the number of slots, and the width of the chart.
 */
export class UserActivityTooltipPlacement {
	/**
	 * Finds the edge of the column of a slot that the tooltip touches. The tooltip sits on the side of the column that has
	 * the most room: at the right of a column in the left half of the chart, and at the left of a column in the right half.
	 *
	 * @param index - The index of the slot, from the oldest slot.
	 * @param slotCount - The number of slots of the histogram.
	 * @param chartWidth - The width of the chart, in pixels.
	 * @returns The side of the tooltip, and the edge of the column that it touches.
	 */
	static column(index: number, slotCount: number, chartWidth: number): UserActivityColumnEdge {
		const slotWidth = (chartWidth - USER_ACTIVITY_CHART_MARGIN.l - USER_ACTIVITY_CHART_MARGIN.r) / slotCount;
		const center = USER_ACTIVITY_CHART_MARGIN.l + (index + 0.5) * slotWidth;
		const halfColumn = (slotWidth * (1 - USER_ACTIVITY_BAR_GAP)) / 2;
		if (center > chartWidth / 2) {
			return { side: "start", edge: center - halfColumn };
		}
		return { side: "end", edge: center + halfColumn };
	}

	/**
	 * Finds the top of the tooltip: its middle is at the height of the pointer, and it stays inside the chart.
	 *
	 * @param pointerY - The height of the pointer in the chart, in pixels.
	 * @param tooltipHeight - The height of the tooltip, in pixels.
	 * @param chartHeight - The height of the chart, in pixels.
	 * @returns The distance from the top of the chart to the top of the tooltip, in pixels.
	 */
	static top(pointerY: number, tooltipHeight: number, chartHeight: number): number {
		const lowest = Math.max(chartHeight - tooltipHeight, 0);
		return Math.min(Math.max(pointerY - tooltipHeight / 2, 0), lowest);
	}

	/**
	 * Finds the top of the arrow inside the tooltip: the arrow is at the height of the pointer, and it stays away from the
	 * round corners of the tooltip.
	 *
	 * @param pointerY - The height of the pointer in the chart, in pixels.
	 * @param tooltipTop - The distance from the top of the chart to the top of the tooltip, in pixels.
	 * @param tooltipHeight - The height of the tooltip, in pixels.
	 * @returns The distance from the top of the tooltip to the top of the arrow, in pixels.
	 */
	static arrowTop(pointerY: number, tooltipTop: number, tooltipHeight: number): number {
		const lowest = Math.max(tooltipHeight - ARROW_WIDTH - ARROW_CORNER_SPACE, ARROW_CORNER_SPACE);
		return Math.min(Math.max(pointerY - tooltipTop - ARROW_WIDTH / 2, ARROW_CORNER_SPACE), lowest);
	}
}
