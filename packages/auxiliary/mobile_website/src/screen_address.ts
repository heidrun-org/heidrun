import type { TabName } from './mobile_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ScreenAddress — writes and reads the part of the address that names the screen that is open
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Where the developer is in the page. */
export type ScreenLocation = {
	/** The screen of the bottom bar that is highlighted, and where the button Back of a pane goes. */
	tab: TabName;
	/** The identifier of the pane that is open, or null when no pane is open. */
	paneId: string | null;
};

/**
 * The address of the page holds the screen that is open, after the sign "#": `#/welcome`, `#/dashboard`,
 * `#/needs-you`, `#/panes`, and `#/panes/<identifier of the pane>`. A reload of the page, and the buttons Back and
 * Forward of the browser, then lead to the same screen. The part after "#" is never sent to a server, and the mobile
 * server needs no route.
 */
export class ScreenAddress {
	/** The word of each screen of the bottom bar in the address. */
	private static readonly words: Record<TabName, string> = {
		welcome: 'welcome',
		dashboard: 'dashboard',
		needs_you: 'needs-you',
		panes: 'panes',
		launchers: 'launchers',
	};

	/**
	 * Writes the address of a screen.
	 * @param tab The screen of the bottom bar.
	 * @param paneId The identifier of the pane that is open, or null.
	 * @returns The part of the address after the path, starting with "#".
	 */
	static format(tab: TabName, paneId: string | null): string {
		const word = ScreenAddress.words[tab];
		if (paneId === null) {
			return `#/${word}`;
		}
		return `#/${word}/${encodeURIComponent(paneId)}`;
	}

	/**
	 * Reads the address of a screen.
	 * @param hash The part of the address after the path, for example `window.location.hash`.
	 * @returns Where the address leads. An address that is empty, wrong, or from a later version of the page leads
	 * to the welcome page.
	 */
	static parse(hash: string): ScreenLocation {
		const segments = hash.replace(/^#\/?/, '').split('/');
		const tab = (Object.keys(ScreenAddress.words) as TabName[]).find((name) => {
			return ScreenAddress.words[name] === segments[0];
		});
		if (tab === undefined) {
			return {
				tab: 'welcome',
				paneId: null,
			};
		}
		return {
			tab,
			paneId: ScreenAddress.decodePaneId(segments[1]),
		};
	}

	private static decodePaneId(segment: string | undefined): string | null {
		if (segment === undefined || segment === '') {
			return null;
		}
		try {
			return decodeURIComponent(segment);
		} catch {
			return null;
		}
	}
}
