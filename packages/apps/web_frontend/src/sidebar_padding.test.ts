import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SidebarPaddingTest — the padding of the two sidebars and of their sidebar sections
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the padding of the left sidebar and of the right sidebar.
 */
class SidebarPaddingTestHelper {
	/**
	 * Reads the text of one style rule of a Vue component.
	 *
	 * @param componentPath The path of the Vue component, relative to the folder `src`.
	 * @param selector The selector of the style rule, for example `.side`.
	 * @returns The text of the style rule, from the selector to the closing brace.
	 */
	static readRule(componentPath: string, selector: string): string {
		const componentText = Fs.readFileSync(Path.resolve(__dirname, componentPath), 'utf8');
		const styleText = componentText.slice(componentText.indexOf('<style'));
		const ruleStart = styleText.indexOf(`\n${selector} {`);
		if (ruleStart === -1) {
			throw new Error(`The style rule ${selector} is missing in ${componentPath}.`);
		}
		return styleText.slice(ruleStart, styleText.indexOf('}', ruleStart));
	}

	/**
	 * Reads the value of one declaration in one style rule of a Vue component.
	 *
	 * @param componentPath The path of the Vue component, relative to the folder `src`.
	 * @param selector The selector of the style rule, for example `.side`.
	 * @param property The name of the declaration, for example `padding`.
	 * @returns The value of the declaration, for example `5px 0 16px`.
	 */
	static readDeclaration(componentPath: string, selector: string, property: string): string {
		const ruleText = SidebarPaddingTestHelper.readRule(componentPath, selector);
		const match = new RegExp(`[\\s;{]${property}:\\s*([^;]+);`).exec(ruleText);
		if (match === null) {
			throw new Error(`The declaration ${property} is missing in the style rule ${selector} of ${componentPath}.`);
		}
		return match[1].trim();
	}
}

describe('padding of the left sidebar', () => {
	it('is 5px at the top, 0 on the left and on the right, and 16px at the bottom', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/Sidebar.vue', '.side', 'padding');
		expect(padding).toBe('5px 0 16px');
	});

	it('leaves the navigation bar without a margin, so its line reaches the left border and the right border', () => {
		const rule = SidebarPaddingTestHelper.readRule('components/Sidebar.vue', '.left-navigation-bar');
		expect(rule).not.toContain('margin');
	});

	it('keeps the buttons of the navigation bar 16px from each border, through the padding of the navigation bar', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/Sidebar.vue', '.left-navigation-bar', 'padding');
		expect(padding).toBe('0 16px');
	});
});

describe('horizontal padding of the sidebar sections of the left sidebar', () => {
	it('is 14px on each side for the Scripts sidebar section', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/ActionsPanel.vue', '.panel', 'padding');
		expect(padding).toBe('18px 14px');
	});

	it('is 16px on each side for the Git sidebar section', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/GitPanel.vue', '.gitp', 'padding');
		expect(padding).toBe('20px 16px');
	});
});

describe('padding of the right sidebar', () => {
	it('has no padding of its own, so the line of the navigation bar reaches the left border and the right border', () => {
		const rule = SidebarPaddingTestHelper.readRule('components/RightPanel.vue', '.right');
		expect(rule).not.toContain('padding');
	});

	it('leaves 5px above the navigation bar, as the left sidebar does, and nothing on the left and on the right', () => {
		const margin = SidebarPaddingTestHelper.readDeclaration('components/RightPanel.vue', '.right-navigation-bar', 'margin');
		expect(margin).toBe('5px 0 0');
	});

	it('keeps the buttons of the navigation bar 16px from each border, through the padding of the navigation bar', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/RightPanel.vue', '.right-navigation-bar', 'padding');
		expect(padding).toBe('0 16px');
	});
});

describe('horizontal padding of the sidebar sections of the right sidebar', () => {
	it('is 6px on each side for the Needs you sidebar section, with 8px above and 16px below', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/ToHandlePanel.vue', '.to-handle', 'padding');
		expect(padding).toBe('8px 6px 16px');
	});

	it('is 14px on each side for the Notes sidebar section, as for the Scripts sidebar section', () => {
		const padding = SidebarPaddingTestHelper.readDeclaration('components/NotesPanel.vue', '.panel', 'padding');
		expect(padding).toBe('18px 14px');
	});
});
