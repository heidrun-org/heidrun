///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NeedsYouWorkspacesHeight — keeps the height of the list of workspaces of the Needs you sidebar section between its limits
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The height of the list of workspaces that the developer chooses by dragging the line above the list (issue #807). Without a
 * chosen height, the list takes the height of its rows, up to 40 percent of the sidebar section.
 */
export class NeedsYouWorkspacesHeight {
	/** The smallest height, in pixels: the separator line, the space above the title, the title, and one row of 40 pixels. */
	static readonly MIN = 84;

	/** The height, in pixels, that the cards of the agents keep at least above the list. */
	static readonly CARDS_MIN = 80;

	/** The step of an arrow key, in pixels, and the step with the key Shift. */
	static readonly STEP = 10;
	static readonly LARGE_STEP = 40;

	/**
	 * Keeps a height between the limits of the list.
	 *
	 * @param height - The wanted height, in pixels.
	 * @param sectionHeight - The height of the whole Needs you sidebar section, in pixels.
	 * @returns The height to use, as a whole number of pixels: never under `MIN`, and never so tall that the cards get less
	 * than `CARDS_MIN`, except when the sidebar section is too small for both, where `MIN` wins.
	 */
	static clamp(height: number, sectionHeight: number): number {
		const largest = Math.max(NeedsYouWorkspacesHeight.MIN, sectionHeight - NeedsYouWorkspacesHeight.CARDS_MIN);
		return Math.round(Math.min(largest, Math.max(NeedsYouWorkspacesHeight.MIN, height)));
	}
}
