import type { Legend } from "plotly.js-basic-dist-min";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ChartInformationCard — the content, and the place beside a bar, of the chart information card of every chart
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The side of the bar where the chart information card sits: at the end of the bar (the right), or at its start. */
export type ChartInformationCardSide = "start" | "end";

/** One row of the chart information card: one series of the chart, with its color and its value in the bar. */
export type ChartInformationCardRow = {
	/** The text that tells two rows apart. */
	key: string;
	/** The name of the series, the same as in the legend. */
	name: string;
	/** The name of the CSS variable that gives the color of the series, for example `--blue-500`. */
	colorToken: string;
	/** The value of the series in the bar, written for the developer, with its unit. */
	value: string;
};

/** What the chart information card of one bar says. */
export type ChartInformationCardContent = {
	/** The first line: what the bar is, for example the start and the end of a slot, or a day. */
	title: string;
	/** The total of all the series in the bar, written with its unit, or `null` when the series cannot be added. */
	total: string | null;
	/** The rows, one for each series that has a value in the bar, in the order of the series. */
	rows: ChartInformationCardRow[];
};

/** Where the chart information card sits: beside the bar, with its arrow at the height of the pointer. */
export type ChartInformationCardAnchor = {
	/** The side of the bar where the card sits. */
	side: ChartInformationCardSide;
	/** The distance from the left side of the chart to the edge of the bar that the card touches, in pixels. */
	edge: number;
	/** The height of the pointer in the chart, in pixels. The arrow of the card points to the bar at this height. */
	pointerY: number;
	/** The width of the chart, in pixels. */
	chartWidth: number;
	/** The height of the chart, in pixels. */
	chartHeight: number;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Constants
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The margins around the plotting area of every chart, in pixels. The chart and its card use the same margins. */
export const CHART_MARGIN = {
	t: 72,
	r: 40,
	b: 64,
	l: 64,
};

/** The share of the width of a bar slot that stays empty between two bars. The chart and its card use the same share. */
export const CHART_BAR_GAP = 0.15;

/**
 * The legend of every chart: one line above the plotting area, with the name of each color. Plotly.js does nothing by
 * itself on a click on the legend, because the choices of the window decide which series the chart shows. A chart can
 * still read the event `plotly_legendclick`, as `StackedBarChart.vue` does to filter its colors.
 */
export const CHART_LEGEND: Partial<Legend> = {
	orientation: "h",
	x: 0,
	y: 1.1,
	traceorder: "normal",
	itemclick: false,
	itemdoubleclick: false,
};

/** The width of the arrow of the card along the side of the card, in pixels: 1.5 rem at the default font size. */
const ARROW_WIDTH = 24;

/** The least space between the arrow and the corner of the card, in pixels. */
const ARROW_CORNER_SPACE = 8;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ChartInformationCard
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The geometry of the chart information card of a bar. The card sits beside the bar, with an arrow that points to the bar,
 * at the height of the pointer. The margins of the chart are fixed, so the place of a bar follows from its index, the
 * number of bars, and the width of the chart.
 */
export class ChartInformationCard {
	/**
	 * Finds where the card of a bar sits. The card sits on the side of the bar that has the most room: at the right of a
	 * bar in the left half of the chart, and at the left of a bar in the right half.
	 *
	 * @param barIndex - The index of the bar, from the first bar.
	 * @param barCount - The number of bars of the chart.
	 * @param pointerY - The height of the pointer in the chart, in pixels.
	 * @param chartWidth - The width of the chart, in pixels.
	 * @param chartHeight - The height of the chart, in pixels.
	 * @returns The side of the card, the edge of the bar that it touches, and the data that the card needs to place itself.
	 */
	static anchor(
		barIndex: number,
		barCount: number,
		pointerY: number,
		chartWidth: number,
		chartHeight: number,
	): ChartInformationCardAnchor {
		const slotWidth = (chartWidth - CHART_MARGIN.l - CHART_MARGIN.r) / barCount;
		const center = CHART_MARGIN.l + (barIndex + 0.5) * slotWidth;
		const halfBar = (slotWidth * (1 - CHART_BAR_GAP)) / 2;
		if (center > chartWidth / 2) {
			return { side: "start", edge: center - halfBar, pointerY, chartWidth, chartHeight };
		}
		return { side: "end", edge: center + halfBar, pointerY, chartWidth, chartHeight };
	}

	/**
	 * Finds the top of the card: its middle is at the height of the pointer, and it stays inside the chart.
	 *
	 * @param pointerY - The height of the pointer in the chart, in pixels.
	 * @param cardHeight - The height of the card, in pixels.
	 * @param chartHeight - The height of the chart, in pixels.
	 * @returns The distance from the top of the chart to the top of the card, in pixels.
	 */
	static top(pointerY: number, cardHeight: number, chartHeight: number): number {
		const lowest = Math.max(chartHeight - cardHeight, 0);
		return Math.min(Math.max(pointerY - cardHeight / 2, 0), lowest);
	}

	/**
	 * Finds the top of the arrow inside the card: the arrow is at the height of the pointer, and it stays away from the
	 * round corners of the card.
	 *
	 * @param pointerY - The height of the pointer in the chart, in pixels.
	 * @param cardTop - The distance from the top of the chart to the top of the card, in pixels.
	 * @param cardHeight - The height of the card, in pixels.
	 * @returns The distance from the top of the card to the top of the arrow, in pixels.
	 */
	static arrowTop(pointerY: number, cardTop: number, cardHeight: number): number {
		const lowest = Math.max(cardHeight - ARROW_WIDTH - ARROW_CORNER_SPACE, ARROW_CORNER_SPACE);
		return Math.min(Math.max(pointerY - cardTop - ARROW_WIDTH / 2, ARROW_CORNER_SPACE), lowest);
	}
}
