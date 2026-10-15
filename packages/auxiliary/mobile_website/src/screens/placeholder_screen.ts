import { HtmlEscape } from '../html_escape';
import { ScreenHeader } from '../components/screen_header';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PlaceholderScreen — a screen of the bottom bar that is not built yet
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the screens Macros and Launchers, until they work.
 */
export class PlaceholderScreen {
	/**
	 * Draws the screen.
	 * @param title The title of the screen.
	 * @param text What the screen will do.
	 * @param isOnline True when the last call worked, false when it failed, null before the first call.
	 * @returns The HTML of the screen, without the bottom bar.
	 */
	static render(title: string, text: string, isOnline: boolean | null): string {
		const screenHtmlContent = /* html */`
			${ScreenHeader.renderTab(title, isOnline)}
			<main><div class="empty">${HtmlEscape.escape(text)}</div></main>
		`;
		return screenHtmlContent;
	}
}
