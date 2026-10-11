import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ViewportFrameTest — the viewport and the two sidebars are frames of the same kind
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the frames of the window: the left sidebar, the viewport, and the right sidebar.
 */
class ViewportFrameTestHelper {
	/**
	 * Reads the value of one declaration in one style rule of a Vue component.
	 *
	 * @param componentPath The path of the Vue component, relative to the folder `src`.
	 * @param selector The selector of the style rule, for example `.center`.
	 * @param property The name of the declaration, for example `border-radius`.
	 * @returns The value of the declaration, for example `8px`.
	 */
	static readDeclaration(componentPath: string, selector: string, property: string): string {
		const componentText = Fs.readFileSync(Path.resolve(__dirname, componentPath), 'utf8');
		const styleText = componentText.slice(componentText.indexOf('<style'));
		const ruleStart = styleText.indexOf(`\n${selector} {`);
		if (ruleStart === -1) {
			throw new Error(`The style rule ${selector} is missing in ${componentPath}.`);
		}
		const ruleText = styleText.slice(ruleStart, styleText.indexOf('}', ruleStart));
		const match = new RegExp(`[\\s;{]${property}:\\s*([^;]+);`).exec(ruleText);
		if (match === null) {
			throw new Error(`The declaration ${property} is missing in the style rule ${selector} of ${componentPath}.`);
		}
		return match[1].trim();
	}

	/**
	 * Reads one declaration of the three frames of the window.
	 *
	 * @param property The name of the declaration, for example `border`.
	 * @returns The value of the declaration for the left sidebar, the viewport, and the right sidebar.
	 */
	static readFrameDeclarations(property: string): { leftSidebar: string; viewport: string; rightSidebar: string } {
		return {
			leftSidebar: ViewportFrameTestHelper.readDeclaration('components/Sidebar.vue', '.side', property),
			viewport: ViewportFrameTestHelper.readDeclaration('App.vue', '.center', property),
			rightSidebar: ViewportFrameTestHelper.readDeclaration('components/RightPanel.vue', '.right', property),
		};
	}
}

describe('frame of the viewport', () => {
	for (const property of ['border', 'border-radius', 'background']) {
		it(`has the same ${property} as the left sidebar and the right sidebar`, () => {
			const declarations = ViewportFrameTestHelper.readFrameDeclarations(property);
			expect(declarations.viewport).toBe(declarations.leftSidebar);
			expect(declarations.viewport).toBe(declarations.rightSidebar);
		});
	}
});
