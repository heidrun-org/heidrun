///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types of the stacked bar chart of the Statistics window
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One color of the bars: the same kind of value for each bar. */
export type StackedBarSeries = {
	/** The name of the color in the legend. */
	name: string;
	/** The name of the CSS variable of the theme that gives the color, for example `--primary-bg`. */
	colorToken: string;
	/** The height of this color in each bar, in the order of the bars. */
	values: number[];
	/** The value of this color in each bar, written with its unit, in the order of the bars. */
	valueTexts: string[];
};

/** The unit of the vertical axis: a count of whole items, an amount in US dollars, or a number of tokens. */
export type StackedBarUnit = "count" | "dollars" | "tokens";

/** Everything that the component `StackedBarChart.vue` needs to draw one chart. */
export type StackedBarChartContent = {
	/** The text under each bar, the same number as the values of each series. */
	labels: string[];
	/** The colors of the bars, from the bottom of a bar to its top. */
	series: StackedBarSeries[];
	/** The first line of the chart information card of each bar, in the order of the bars, for example the day. */
	titles: string[];
	/** The total of all the colors in each bar, written with its unit, or `null` when the colors cannot be added. */
	totals: string[] | null;
	/** The title of the chart. */
	title: string;
	/** The title of the horizontal axis. */
	horizontalAxisTitle: string;
	/** The title of the vertical axis. */
	verticalAxisTitle: string;
	/** The unit of the vertical axis. */
	verticalAxisUnit: StackedBarUnit;
	/** The text that a screen reader reads for the chart. */
	chartLabel: string;
};
