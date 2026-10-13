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

	it('uses the Bootstrap menu classes', () => {
		for (const className of ['menu', 'menu-item', 'menu-header', 'menu-divider', 'menu-text']) {
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

	it('uses the Bootstrap close button, and the Bootstrap form classes', () => {
		const classNameList = ['btn-close', 'form-label', 'form-control', 'form-text'];
		for (const className of classNameList) {
			expect(sourceText).toContain(className);
		}
	});

	it('does not use the Bootstrap parts dialog and check, whose class names the windows and the labels of the application already use', () => {
		for (const className of ['modal', 'form-select', 'form-check']) {
			expect(sourceText).not.toContain(className);
		}
	});

	it('styles only the box of the window, because the application has its own class dialog', () => {
		const classNameList = MacroBootstrapTestHelper.listStyledClassNames(sourceText);
		expect([...new Set(classNameList)]).toEqual(['overlay', 'dialog', 'dialog-header', 'dialog-body', 'dialog-footer']);
	});
});

describe('the theme of Bootstrap', () => {
	it('is the theme of the application: styles.css gives the Bootstrap variables the colors of the application', () => {
		const stylesText = Fs.readFileSync(Path.resolve(__dirname, 'styles.css'), 'utf8');
		for (const variableName of ['--fg-body', '--bg-body', '--border-color', '--fg-3']) {
			expect(stylesText).toContain(`${variableName}:`);
		}
	});
});
