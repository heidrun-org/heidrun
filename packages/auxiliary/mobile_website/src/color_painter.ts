///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ColorPainter — sets the colors of the output once its HTML is in the page
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The content security policy of the mobile server refuses a `style` attribute that is written in HTML, but it allows
 * a style that a script sets on an element. So the HTML of the output carries each color in a data attribute, and this
 * class sets the style from it.
 */
export class ColorPainter {
	/**
	 * Sets the text color and the background color of every element that has a color in a data attribute.
	 * @param container The element that holds the HTML.
	 */
	static paint(container: Element): void {
		for (const element of container.querySelectorAll<HTMLElement>('[data-fg], [data-bg]')) {
			if (element.dataset.fg !== undefined) {
				element.style.color = element.dataset.fg;
			}
			if (element.dataset.bg !== undefined) {
				element.style.backgroundColor = element.dataset.bg;
			}
		}
	}
}
