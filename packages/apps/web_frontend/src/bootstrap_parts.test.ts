import Path from 'node:path';
import * as Sass from 'sass';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	BootstrapPartsTest — the compiled Bootstrap parts must stay inside one CSS layer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of `bootstrap_parts.scss`.
 */
class BootstrapPartsTestHelper {
	/**
	 * Compiles `bootstrap_parts.scss` the way Vite compiles it.
	 *
	 * @returns The CSS text.
	 */
	static compile(): string {
		const result = Sass.compile(Path.resolve(__dirname, 'bootstrap_parts.scss'), {
			loadPaths: [Path.resolve(__dirname, '../node_modules')],
			quietDeps: true,
			silenceDeprecations: ['import'],
		});
		return result.css;
	}

	/**
	 * Lists what stands at the top level of a CSS text: the selector of each rule, and the head of each at-rule.
	 *
	 * @param cssText - The CSS text.
	 * @returns The top-level selectors and at-rule heads, in order.
	 */
	static listTopLevelHeads(cssText: string): string[] {
		const textWithoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
		const headList: string[] = [];
		let depth = 0;
		let headStart = 0;
		for (let index = 0; index < textWithoutComments.length; index++) {
			const character = textWithoutComments[index];
			if (character === '{') {
				if (depth === 0) {
					headList.push(textWithoutComments.slice(headStart, index).trim());
				}
				depth += 1;
			} else if (character === '}') {
				depth -= 1;
				if (depth === 0) {
					headStart = index + 1;
				}
			} else if (character === ';' && depth === 0) {
				headStart = index + 1;
			}
		}
		return headList;
	}
}

describe('bootstrap_parts.scss', () => {
	it('puts every Bootstrap rule in the layer, so that a rule of the application always wins', () => {
		const headList = BootstrapPartsTestHelper.listTopLevelHeads(BootstrapPartsTestHelper.compile());
		expect(headList).toEqual(['@layer bootstrap', '.btn', '.btn:disabled']);
	});

	it('has only the four utility classes that the web frontend uses, and they sit in the layer', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		const layerText = cssText.slice(cssText.indexOf('@layer bootstrap'), cssText.indexOf('\n.btn {'));
		const utilityRuleList = layerText.match(/^ {2}\.(d|align-items|justify-content|border)-[a-z0-9-]+ \{/gm) ?? [];
		expect(utilityRuleList.map((rule) => rule.trim())).toEqual([
			'.d-inline-flex {',
			'.align-items-center {',
			'.justify-content-center {',
			'.border-0 {',
		]);
	});

	it('gives the button the line height of the application', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toContain('--bs-btn-line-height: 1.4;');
	});

	it('gives the button no transition, as the application has none', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).not.toContain('transition: color 0.15s');
	});
});
