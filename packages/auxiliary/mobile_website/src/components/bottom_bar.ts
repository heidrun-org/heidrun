import type { TabName } from '../mobile_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	BottomBar — the five buttons at the bottom of every screen
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One button of the bottom bar. */
type BarButton = {
	/** The screen that the button opens. */
	tab: TabName;
	/** The word under the icon. */
	label: string;
	/** The inside of the SVG element of the icon: simple strokes on a grid of 24 by 24. */
	iconHtmlContent: string;
};

/**
 * Draws the bottom bar: Dashboard, Needs you, Panes, Macros, and Launchers.
 */
export class BottomBar {
	/** The five buttons, from left to right. */
	private static readonly buttons: BarButton[] = [
		{
			tab: 'dashboard',
			label: 'Dashboard',
			iconHtmlContent:
				'<rect x="3" y="3" width="7" height="9" rx="1.5"/>' +
				'<rect x="14" y="3" width="7" height="5" rx="1.5"/>' +
				'<rect x="14" y="12" width="7" height="9" rx="1.5"/>' +
				'<rect x="3" y="16" width="7" height="5" rx="1.5"/>',
		},
		{
			tab: 'needs_you',
			label: 'Needs you',
			iconHtmlContent:
				'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>' +
				'<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
		},
		{
			tab: 'panes',
			label: 'Panes',
			iconHtmlContent:
				'<rect x="3" y="4" width="18" height="7" rx="2"/>' +
				'<rect x="3" y="13" width="18" height="7" rx="2"/>',
		},
		{
			tab: 'macros',
			label: 'Macros',
			iconHtmlContent: '<path d="M4 6h10M4 12h6M4 18h6M16 15h6M19 12v6"/>',
		},
		{
			tab: 'launchers',
			label: 'Launchers',
			iconHtmlContent: '<path d="M7 4l13 8-13 8z"/>',
		},
	];

	/**
	 * Draws the bar.
	 * @param active The screen that is open, or the screen that the open pane came from.
	 * @returns The HTML of the bar.
	 */
	static render(active: TabName): string {
		const buttonsHtmlContent = BottomBar.buttons
			.map((button) => {
				const isActive = button.tab === active;
				const className = isActive ? 'bar-button bar-button-active' : 'bar-button';
				const currentAttribute = isActive ? 'aria-current="page"' : '';
				const itemHtmlContent = /* html */`
					<button
						class="${className}"
						data-action="go"
						data-screen="${button.tab}"
						${currentAttribute}
					>
						<svg
							viewBox="0 0 24 24"
							width="22"
							height="22"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>${button.iconHtmlContent}</svg>
						<span>${button.label}</span>
					</button>
				`;
				return itemHtmlContent;
			})
			.join('');
		const barHtmlContent = /* html */`<nav class="bottom-bar">${buttonsHtmlContent}</nav>`;
		return barHtmlContent;
	}
}
