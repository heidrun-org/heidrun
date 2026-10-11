import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MacroBootstrapTest — the dropdown and the pop-up of the macros are made of Bootstrap classes
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the Bootstrap markup of the macros.
 */
class MacroBootstrapTestHelper {
	/**
	 * Reads the source of a component of the folder `components`.
	 *
	 * @param fileName - The name of the file, for example `MacroMenu.vue`.
	 * @returns The source text of the component.
	 */
	static readComponent(fileName: string): string {
		return Fs.readFileSync(Path.resolve(__dirname, 'components', fileName), 'utf8');
	}

	/**
	 * Lists the class selectors that a `<style>` block of a component declares.
	 *
	 * @param sourceText - The source text of the component.
	 * @returns The class names, in order, without the dot.
	 */
	static listStyledClassNames(sourceText: string): string[] {
		const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(sourceText);
		if (styleMatch === null) {
			return [];
		}
		return [...styleMatch[1].matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]);
	}
}

describe('the dropdown of the macros (MacroMenu.vue)', () => {
	const sourceText = MacroBootstrapTestHelper.readComponent('MacroMenu.vue');

	it('uses the Bootstrap dropdown classes', () => {
		for (const className of ['dropdown-menu', 'dropdown-item', 'dropdown-header', 'dropdown-divider', 'dropdown-item-text']) {
			expect(sourceText).toContain(className);
		}
	});

	it('writes no style rule of its own, except the rules of the button that opens it', () => {
		const classNameList = MacroBootstrapTestHelper.listStyledClassNames(sourceText);
		expect(classNameList.every((className) => className === 'tool' || className === 'on')).toBe(true);
	});
});

describe('the pop-up of the macros (MacroEditor.vue)', () => {
	const sourceText = MacroBootstrapTestHelper.readComponent('MacroEditor.vue');

	it('uses the Bootstrap modal classes, and the Bootstrap form classes', () => {
		const classNameList = [
			'modal-backdrop',
			'modal-dialog',
			'modal-content',
			'modal-header',
			'modal-title',
			'btn-close',
			'modal-body',
			'modal-footer',
			'form-label',
			'form-control',
			'form-select',
			'form-check',
			'form-check-input',
			'form-text',
		];
		for (const className of classNameList) {
			expect(sourceText).toContain(className);
		}
	});

	it('has no style block: the layout comes from the Bootstrap utility classes', () => {
		expect(sourceText).not.toContain('<style');
	});
});

describe('the theme of Bootstrap', () => {
	it('is the theme of the application: styles.css gives the Bootstrap variables the colors of the application', () => {
		const stylesText = Fs.readFileSync(Path.resolve(__dirname, 'styles.css'), 'utf8');
		for (const variableName of ['--bs-body-color', '--bs-body-bg', '--bs-border-color', '--bs-secondary-color']) {
			expect(stylesText).toContain(`${variableName}:`);
		}
	});
});
