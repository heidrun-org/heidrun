import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	StatusBarBootstrapTest — the cards above the status bar are made of Bootstrap classes
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the Bootstrap markup of the cards above the status bar.
 */
class StatusBarBootstrapTestHelper {
	/**
	 * Reads the source of a component of the folder `components`.
	 *
	 * @param fileName - The name of the file, for example `QuotaSummary.vue`.
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

describe('the cards of the quotas (QuotaSummary.vue)', () => {
	const sourceText = StatusBarBootstrapTestHelper.readComponent('QuotaSummary.vue');

	it('uses the Bootstrap popover, progress bar, and alert classes', () => {
		for (const className of ['popover', 'popover-arrow', 'popover-header', 'popover-body', 'progress', 'progress-bar', 'alert']) {
			expect(sourceText).toContain(className);
		}
	});

	it('writes style rules only for the item in the status bar, and not for the card', () => {
		const allowedClassNameList = ['quota', 'label', 'percent', 'unit', 'ring', 'track', 'arc'];
		const classNameList = StatusBarBootstrapTestHelper.listStyledClassNames(sourceText);
		expect(classNameList.filter((className) => allowedClassNameList.includes(className) === false)).toEqual([]);
	});
});

describe('the card of the git branch (GitStatusSummary.vue)', () => {
	const sourceText = StatusBarBootstrapTestHelper.readComponent('GitStatusSummary.vue');

	it('uses the Bootstrap popover classes', () => {
		for (const className of ['popover', 'popover-arrow', 'popover-header', 'popover-body']) {
			expect(sourceText).toContain(className);
		}
	});

	it('writes style rules only for the item in the status bar, and not for the card', () => {
		const allowedClassNameList = ['git-status', 'behind', 'ahead', 'count'];
		const classNameList = StatusBarBootstrapTestHelper.listStyledClassNames(sourceText);
		expect(classNameList.filter((className) => allowedClassNameList.includes(className) === false)).toEqual([]);
	});
});

describe('the theme of Bootstrap', () => {
	it('gives the Bootstrap variables of the popover, the progress bar, and the alert the colors of the application', () => {
		const stylesText = Fs.readFileSync(Path.resolve(__dirname, 'styles.css'), 'utf8');
		for (const variableName of ['--bs-secondary-bg', '--bs-success', '--bs-warning', '--bs-danger', '--bs-popover-zindex']) {
			expect(stylesText).toContain(`${variableName}:`);
		}
	});
});
