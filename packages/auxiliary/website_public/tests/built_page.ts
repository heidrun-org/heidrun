///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	BuiltPage — reads the tags of a page that VitePress built, for the tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Reads the tags of a built page. */
export class BuiltPage {
	/**
	 * Reads the value of a `meta` tag.
	 * @param html - The text of the built page.
	 * @param attribute - The attribute that names the tag: `property` for Open Graph, `name` for the others.
	 * @param key - The value of that attribute, such as `og:title`.
	 * @returns The value of the attribute `content`, or null when the page has no such tag.
	 */
	static metaContent(html: string, attribute: 'property' | 'name', key: string): string | null {
		const match = html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)">`));
		return match === null ? null : BuiltPage._unescape(match[1]);
	}

	/**
	 * Reads the canonical address.
	 * @param html - The text of the built page.
	 * @returns The address of the tag `link rel="canonical"`, or null when the page has none.
	 */
	static canonical(html: string): string | null {
		const match = html.match(/<link rel="canonical" href="([^"]*)">/);
		return match === null ? null : match[1];
	}

	/**
	 * Reads the content of the tag `title`.
	 * @param html - The text of the built page.
	 * @returns The title, or null when the page has none.
	 */
	static title(html: string): string | null {
		const match = html.match(/<title>([^<]*)<\/title>/);
		return match === null ? null : BuiltPage._unescape(match[1]);
	}

	/**
	 * Replaces the HTML entities that the build writes inside an attribute.
	 * @param text - The raw text of the attribute.
	 * @returns The text with the quotes and the ampersands restored.
	 */
	private static _unescape(text: string): string {
		return text.replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
	}
}
