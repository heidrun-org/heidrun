///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PlotlyLoader — loads Plotly.js once, when the first chart needs it
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The build of Plotly.js that has only the bar chart. */
export type PlotlyModule = typeof import("plotly.js-basic-dist-min");

/**
 * Loads Plotly.js on demand, so the windows that draw no chart do not pay for its size. Several charts that open together
 * share one load: the first call starts it, and every call gets the same result.
 */
export class PlotlyLoader {
	/** The load that runs or is finished, or `null` before the first call. */
	private static _loading: Promise<PlotlyModule> | null = null;

	/**
	 * Gives Plotly.js. The first call loads it.
	 *
	 * @returns Plotly.js.
	 */
	static load(): Promise<PlotlyModule> {
		if (PlotlyLoader._loading === null) {
			PlotlyLoader._loading = import("plotly.js-basic-dist-min").then((module) => module.default);
		}
		return PlotlyLoader._loading;
	}
}
