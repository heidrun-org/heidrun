import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ScrollbarRulesTest — every scroll bar has the discreet look of the global rule in styles.css
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the scroll bar rules.
 */
class ScrollbarRulesTestHelper {
	/**
	 * Lists the source files of the web frontend that hold styles.
	 *
	 * @returns The absolute paths of the `.vue` and `.css` files under `src`.
	 */
	static listStyleFilePaths(): string[] {
		const pathList: string[] = [];
		const walk = (folderPath: string): void => {
			for (const entry of Fs.readdirSync(folderPath, { withFileTypes: true })) {
				const entryPath = Path.join(folderPath, entry.name);
				if (entry.isDirectory() === true) {
					walk(entryPath);
				} else if (entry.name.endsWith('.vue') === true || entry.name.endsWith('.css') === true) {
					pathList.push(entryPath);
				}
			}
		};
		walk(__dirname);
		return pathList;
	}
}

describe('the scroll bars', () => {
	it('have one global rule in styles.css: narrow, no track, and a thumb made of the text color at low strength', () => {
		const stylesText = Fs.readFileSync(Path.resolve(__dirname, 'styles.css'), 'utf8');
		expect(stylesText).toMatch(/\*::-webkit-scrollbar \{ width: 8px; height: 8px; background: transparent; \}/);
		expect(stylesText).toMatch(/\*::-webkit-scrollbar-thumb \{ background-color: color-mix\(in srgb, var\(--text\) 12%, transparent\)/);
		expect(stylesText).toContain('*:hover::-webkit-scrollbar-thumb');
		expect(stylesText).toContain('*::-webkit-scrollbar-thumb:hover');
	});

	it('are never styled by a component: no other file writes a scrollbar pseudo-element', () => {
		for (const filePath of ScrollbarRulesTestHelper.listStyleFilePaths()) {
			if (filePath.endsWith('styles.css') === true || filePath.endsWith('.test.ts') === true) {
				continue;
			}
			const sourceText = Fs.readFileSync(filePath, 'utf8');
			expect({ filePath, hasPseudoElement: sourceText.includes('::-webkit-scrollbar') }).toEqual({
				filePath,
				hasPseudoElement: false,
			});
		}
	});

	it('are never given scrollbar-width or scrollbar-color, which replace the pseudo-elements in Chrome, except the value none', () => {
		for (const filePath of ScrollbarRulesTestHelper.listStyleFilePaths()) {
			const sourceText = Fs.readFileSync(filePath, 'utf8');
			const propertyList = [...sourceText.matchAll(/scrollbar-(?:width|color)\s*:\s*([^;}\n]+)/g)].map((match) => match[1].trim());
			expect({ filePath, propertyList: propertyList.filter((value) => value !== 'none') }).toEqual({
				filePath,
				propertyList: [],
			});
		}
	});
});
