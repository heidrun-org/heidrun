import { HtmlEscape } from '../html_escape';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ScreenHeader — the bar at the top of a screen
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the top bar of a screen.
 */
export class ScreenHeader {
	/**
	 * Draws the top bar of a screen of the bottom bar: the title and the state of the connection to the Mac.
	 * @param title The title of the screen.
	 * @param isOnline True when the last call worked, false when it failed, null before the first call.
	 * @returns The HTML of the top bar.
	 */
	static renderTab(title: string, isOnline: boolean | null): string {
		const connection = isOnline === true ? 'dot-ok' : isOnline === false ? 'dot-blocked' : 'dot-idle';
		const connectionText = isOnline === true ? 'Connected to the Mac' : 'Not connected to the Mac';
		const headerHtmlContent = /* html */`
			<header class="top">
				<h1>${HtmlEscape.escape(title)}</h1>
				<span class="dot ${connection}" role="img" aria-label="${connectionText}"></span>
			</header>
		`;
		return headerHtmlContent;
	}

	/**
	 * Draws the top bar of the screen of one pane: a back button, the title, and a badge.
	 * @param title The title of the screen.
	 * @param badgeHtmlContent The HTML of the badge, or an empty text.
	 * @returns The HTML of the top bar.
	 */
	static renderPane(title: string, badgeHtmlContent: string): string {
		const headerHtmlContent = /* html */`
			<header class="top">
				<button class="back" data-action="back" aria-label="Back">‹</button>
				<h1>${HtmlEscape.escape(title)}</h1>
				${badgeHtmlContent}
			</header>
		`;
		return headerHtmlContent;
	}
}
