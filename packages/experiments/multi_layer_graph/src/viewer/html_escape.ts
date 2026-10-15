///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HtmlEscape — escapes a text before it goes into HTML
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Escapes a text before it goes into HTML. The titles of the issues, of the pull requests, and of the commits are
 * written by people, so every one of them goes through this class.
 */
export class HtmlEscape {
	/**
	 * Escapes the five characters that HTML reads as markup.
	 * @param value The text.
	 * @returns The escaped text, safe in an element and in an attribute between double quotes.
	 */
	static text(value: string): string {
		const escapedText = value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
		return escapedText;
	}
}
