import arrowClockwise from 'bootstrap-icons/icons/arrow-clockwise.svg?raw';
import bell from 'bootstrap-icons/icons/bell.svg?raw';
import chevronLeft from 'bootstrap-icons/icons/chevron-left.svg?raw';
import grid from 'bootstrap-icons/icons/grid.svg?raw';
import lightningCharge from 'bootstrap-icons/icons/lightning-charge.svg?raw';
import play from 'bootstrap-icons/icons/play.svg?raw';
import sendFill from 'bootstrap-icons/icons/send-fill.svg?raw';
import stopFill from 'bootstrap-icons/icons/stop-fill.svg?raw';
import viewStacked from 'bootstrap-icons/icons/view-stacked.svg?raw';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Icon — the Bootstrap Icons of the page, drawn as inline SVG
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The name of an icon of the page. It is the name of the icon in Bootstrap Icons. */
export type IconName =
	| 'arrow-clockwise'
	| 'bell'
	| 'chevron-left'
	| 'grid'
	| 'lightning-charge'
	| 'play'
	| 'send-fill'
	| 'stop-fill'
	| 'view-stacked';

/**
 * Draws the icons of the page. Every icon comes from the package `bootstrap-icons`, and Vite puts its SVG in the
 * built page, so the page loads no icon font and no file from another address. The strict content security policy
 * of the mobile server needs it so.
 */
export class Icon {
	/** The SVG text of each icon, as the package `bootstrap-icons` has it. */
	private static readonly svgByName: Record<IconName, string> = {
		'arrow-clockwise': arrowClockwise,
		'bell': bell,
		'chevron-left': chevronLeft,
		'grid': grid,
		'lightning-charge': lightningCharge,
		'play': play,
		'send-fill': sendFill,
		'stop-fill': stopFill,
		'view-stacked': viewStacked,
	};

	/**
	 * Draws one icon. The icon takes the color of the text around it.
	 * @param name The name of the icon in Bootstrap Icons.
	 * @param size The width and the height of the icon, in pixels.
	 * @returns The HTML of the icon: an SVG element, hidden from screen readers.
	 */
	static render(name: IconName, size: number): string {
		const svgText = Icon.svgByName[name];
		const iconHtmlContent = svgText
			.replace('width="16" height="16"', `width="${size}" height="${size}" aria-hidden="true"`)
			.trim();
		return iconHtmlContent;
	}
}
