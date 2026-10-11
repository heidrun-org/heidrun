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

	it('has only the utility classes that the web frontend uses, and they sit in the layer', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		const layerText = cssText.slice(cssText.indexOf('@layer bootstrap'), cssText.indexOf('\n.btn {'));
		const utilityRuleList = layerText.match(/^ {2}\.(d|flex|h|align-items|gap|ms|me|mb|pt|fw|text|bg|position|top|bottom|overflow-y|justify-content|border)-[a-z0-9-]+ \{/gm) ?? [];
		expect(utilityRuleList.map((rule) => rule.trim().replace(' {', ''))).toEqual([
			'.justify-content-center',
			'.justify-content-between',
			'.border-0',
			'.border-top',
			'.d-block',
			'.d-flex',
			'.flex-column',
			'.flex-fill',
			'.align-items-center',
			'.gap-2',
			'.gap-3',
			'.ms-3',
			'.me-auto',
			'.mb-3',
			'.pt-2',
			'.fw-medium',
			'.fw-semibold',
			'.text-start',
			'.text-end',
			'.text-break',
			'.text-wrap',
			'.text-primary-emphasis',
			'.text-success-emphasis',
			'.text-warning-emphasis',
			'.text-danger-emphasis',
			'.text-body-secondary',
			'.bg-success',
			'.bg-warning',
			'.bg-danger',
			'.bg-body-emphasis',
			'.position-fixed',
			'.position-absolute',
			'.position-relative',
			'.top-0',
			'.bottom-0',
			'.bottom-100',
			'.h-auto',
			'.overflow-y-auto',
		]);
	});

	it('has the Bootstrap parts of the dropdown, the modal, the close button, the form fields, the popover, the progress bar, the alert, the list group, and the spinner', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		for (const selector of ['.dropdown-menu', '.dropdown-item', '.modal', '.modal-content', '.btn-close', '.form-control', '.form-select', '.form-check-input', '.form-label', '.popover', '.popover-body', '.popover-arrow', '.progress', '.progress-bar', '.alert', '.alert-success', '.alert-warning', '.alert-danger', '.list-group', '.list-group-item', '.list-group-flush', '.spinner-border', '.spinner-border-sm']) {
			expect(cssText).toContain(`${selector} {`);
		}
	});

	it('gives a row of a list group no background of its own, so that the sidebar shows through in both themes', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\.list-group \{[^}]*--bs-list-group-bg: transparent/);
	});

	it('has the Bootstrap part of the nav with tabs, and gives the links of the nav no transition', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		for (const selector of ['.nav', '.nav-link', '.nav-tabs', '.nav-tabs .nav-link']) {
			expect(cssText).toContain(`${selector} {`);
		}
		expect(cssText).not.toContain('transition: color 0.15s');
	});

	it('draws the text of a field with the variable --font-size, so that the font size setting reaches it', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\.form-control \{[^}]*font-size: var\(--font-size\)/);
	});

	it('gives the button no transition, as the application has none', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).not.toContain('transition: color 0.15s');
	});
});
