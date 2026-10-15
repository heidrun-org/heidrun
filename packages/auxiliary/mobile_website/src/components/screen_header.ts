import { HtmlEscape } from '../html_escape';
import { Icon } from './icon';

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
	 * Draws the top bar of a screen of the bottom bar: the title and the state of the connection to the computer.
	 * @param title The title of the screen.
	 * @param isOnline True when the last call worked, false when it failed, null before the first call.
	 * @returns The HTML of the top bar.
	 */
	static renderTab(title: string, isOnline: boolean | null): string {
		const connection = isOnline === true ? 'dot-ok' : isOnline === false ? 'dot-blocked' : 'dot-idle';
		const connectionText = isOnline === true ? 'Connected' : 'Not connected';
		const headerHtmlContent = /* html */`
			<header class="top">
				<h1>${HtmlEscape.escape(title)}</h1>
				<span class="dot ${connection}" role="img" aria-label="${connectionText}"></span>
			</header>
		`;
		return headerHtmlContent;
	}

	/**
	 * Draws the top bar of the screen of one pane: a back button, the title, a badge, and a button that refreshes
	 * the output.
	 * @param title The title of the screen.
	 * @param badgeHtmlContent The HTML of the badge, or an empty text.
	 * @returns The HTML of the top bar.
	 */
	static renderPane(title: string, badgeHtmlContent: string): string {
		const headerHtmlContent = /* html */`
			<header class="top">
				<button class="back" data-action="back" aria-label="Back">
					${Icon.render('chevron-left', 24)}
				</button>
				<h1>${HtmlEscape.escape(title)}</h1>
				${badgeHtmlContent}
				<button class="icon-button" data-action="refresh" aria-label="Refresh" title="Refresh">
					${Icon.render('arrow-clockwise', 20)}
				</button>
			</header>
		`;
		return headerHtmlContent;
	}
}
