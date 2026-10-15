///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ChartTheme — gives the colors of the theme to a chart that Plotly.js draws
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The colors of the theme for the charts of the Statistics window. Plotly.js does not read the CSS functions `light-dark`
 * and `color-mix` that the theme of Bootstrap uses, so the browser resolves each color first, and a canvas turns it into
 * `rgba(...)`.
 */
export class ChartTheme {
	/**
	 * Gives a color of the theme as a text that Plotly.js can read.
	 *
	 * @param token - The name of the CSS variable, for example `--fg-body`.
	 * @param anchor - The element that holds the chart. The color is resolved inside it, so it follows its theme.
	 * @returns The color, written `rgba(red, green, blue, alpha)`.
	 */
	static readColor(token: string, anchor: HTMLElement | undefined): string {
		const probe = document.createElement("span");
		probe.style.color = `var(${token})`;
		anchor?.appendChild(probe);
		const resolved = getComputedStyle(probe).color;
		probe.remove();
		const context = document.createElement("canvas").getContext("2d");
		if (context === null) {
			return resolved;
		}
		context.clearRect(0, 0, 1, 1);
		context.fillStyle = resolved;
		context.fillRect(0, 0, 1, 1);
		const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
		return `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
	}
}
