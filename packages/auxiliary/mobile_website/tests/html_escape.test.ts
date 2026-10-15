import { describe, expect, it } from 'vitest';
import { HtmlEscape } from '../src/html_escape';

describe('HtmlEscape', () => {
	it('replaces the five characters that HTML reads as markup', () => {
		expect(HtmlEscape.escape(`<a href="x" title='y'>&</a>`)).toBe(
			'&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
		);
	});

	it('writes a number as a text', () => {
		expect(HtmlEscape.escape(42)).toBe('42');
	});

	it('escapes a text that was already escaped, so the developer sees the exact text', () => {
		expect(HtmlEscape.escape('&amp;')).toBe('&amp;amp;');
	});
});
