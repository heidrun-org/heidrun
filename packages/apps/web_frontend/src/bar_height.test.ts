import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	BarHeightTest — the tab bar of the viewport and the navigation bar of each sidebar have the same height
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the height of the tab bar and of the navigation bars.
 */
class BarHeightTestHelper {
	/**
	 * Reads the height, in pixels, that one style rule of a Vue component gives to its element.
	 *
	 * @param componentPath The path of the Vue component, relative to the folder `src`.
	 * @param selector The selector of the style rule, for example `.nav-tabs .nav-link`.
	 * @returns The height in pixels, for example `34`.
	 */
	static readHeight(componentPath: string, selector: string): number {
		const componentText = Fs.readFileSync(Path.resolve(__dirname, componentPath), 'utf8');
		const styleText = componentText.slice(componentText.indexOf('<style'));
		const ruleStart = styleText.indexOf(`\n${selector} {`);
		if (ruleStart === -1) {
			throw new Error(`The style rule ${selector} is missing in ${componentPath}.`);
		}
		const ruleText = styleText.slice(ruleStart, styleText.indexOf('}', ruleStart));
		const match = /[\s;{]height:\s*(\d+)px;/.exec(ruleText);
		if (match === null) {
			throw new Error(`The height in pixels is missing in the style rule ${selector} of ${componentPath}.`);
		}
		return Number(match[1]);
	}
}

describe('height of a button of the navigation bar of a sidebar', () => {
	it('is the height of a tab of the tab bar, so that the three bars have the same height', () => {
		const tabHeight = BarHeightTestHelper.readHeight('components/TabBar.vue', '.nav-tabs .nav-link');
		const buttonHeight = BarHeightTestHelper.readHeight('components/NavigationBar.vue', '.navigation-bar button');
		expect(buttonHeight).toBe(tabHeight);
	});
});
