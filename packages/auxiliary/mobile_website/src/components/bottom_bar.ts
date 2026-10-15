import type { TabName } from '../mobile_types';
import { Icon } from './icon';
import type { IconName } from './icon';

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
	/** The icon above the word, by its name in Bootstrap Icons. */
	iconName: IconName;
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
			iconName: 'grid',
		},
		{
			tab: 'needs_you',
			label: 'Needs you',
			iconName: 'bell',
		},
		{
			tab: 'panes',
			label: 'Panes',
			iconName: 'view-stacked',
		},
		{
			tab: 'macros',
			label: 'Macros',
			iconName: 'lightning-charge',
		},
		{
			tab: 'launchers',
			label: 'Launchers',
			iconName: 'play',
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
						${Icon.render(button.iconName, 22)}
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
