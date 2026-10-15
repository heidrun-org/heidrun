///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HtmlEscape — makes a text safe to put inside HTML
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Escapes the text that comes from the Mac or from a coding agent before it goes into a template of HTML.
 */
export class HtmlEscape {
	/**
	 * Replaces the five characters that HTML reads as markup.
	 * @param value The text or the number to show.
	 * @returns The same text, safe inside an element and inside a quoted attribute.
	 */
	static escape(value: string | number): string {
		return String(value)
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}
}
