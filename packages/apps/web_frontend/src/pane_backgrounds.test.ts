import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneBackgroundsTest — the window shell and the sidebar share one background, and the pane has a lighter one, as in VS Code
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the background colours in `styles.css`.
 */
class PaneBackgroundsTestHelper {
	/**
	 * Reads one colour variable from the block of one theme in `styles.css`.
	 *
	 * @param selector - The selector that opens the block, for example `:root`.
	 * @param variableName - The variable name, for example `--shell`.
	 * @returns The value of the variable.
	 */
	static readVariable(selector: string, variableName: string): string {
		const cssText = Fs.readFileSync(Path.resolve(__dirname, 'styles.css'), 'utf8');
		const blockStart = cssText.indexOf(`${selector} {`);
		const blockEnd = cssText.indexOf('}', blockStart);
		const blockText = cssText.slice(blockStart, blockEnd);
		const match = new RegExp(`${variableName}:\\s*([^;]+);`).exec(blockText);
		if (match === null) {
			throw new Error(`The variable ${variableName} is missing in the block ${selector}.`);
		}
		return match[1].trim();
	}
}

describe('background colours of the window', () => {
	for (const selector of [':root', ':root[data-theme="light"]']) {
		it(`gives the shell and the sidebar the same background, and the pane another one, in ${selector}`, () => {
			const shell = PaneBackgroundsTestHelper.readVariable(selector, '--shell');
			const side = PaneBackgroundsTestHelper.readVariable(selector, '--side');
			const viewport = PaneBackgroundsTestHelper.readVariable(selector, '--bg');
			expect(side).toBe(shell);
			expect(viewport).not.toBe(shell);
		});

		it(`makes the pane background lighter than the shell and the sidebar background in ${selector}`, () => {
			const side = PaneBackgroundsTestHelper.readVariable(selector, '--side');
			const viewport = PaneBackgroundsTestHelper.readVariable(selector, '--bg');
			expect(viewport > side).toBe(true);
		});
	}
});
