import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsGeneralSectionTest — the question mark button looks like the one of the Installed skill window
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the style of `SettingsGeneralSection.vue`.
 */
class SettingsGeneralSectionTestHelper {
	/**
	 * Reads the declarations of the style rule `.helpButton` in `SettingsGeneralSection.vue`.
	 *
	 * @returns The text between the braces of the rule.
	 */
	static readHelpButtonRule(): string {
		const sourceText = Fs.readFileSync(Path.resolve(__dirname, 'SettingsGeneralSection.vue'), 'utf8');
		const match = /^\.helpButton\s*\{([^}]*)\}/m.exec(sourceText);
		if (match === null) {
			throw new Error('The style rule .helpButton is missing in SettingsGeneralSection.vue.');
		}
		return match[1];
	}
}

describe('question mark button of the setting Keep agents running after quit', () => {
	it('has no background disc and no border, because the style of the Settings window does not reach this component', () => {
		const ruleText = SettingsGeneralSectionTestHelper.readHelpButtonRule();
		expect(ruleText).toMatch(/background:\s*transparent/);
		expect(ruleText).toMatch(/border:\s*0/);
	});
});
