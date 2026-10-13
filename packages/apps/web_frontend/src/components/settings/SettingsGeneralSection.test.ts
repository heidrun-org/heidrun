import Fs from 'node:fs';
import Path from 'node:path';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsGeneralSection from './SettingsGeneralSection.vue';
import { settings } from '../../stores/settings';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));

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

describe('heading Ask before closing', () => {
	beforeEach(() => {
		settings.confirmWorkspaceClose = true;
		settings.confirmTabClose = true;
		settings.confirmPaneClose = true;
	});

	it('replaces the heading Tabs, and holds three checkboxes: workspace, then tab, then pane', () => {
		const wrapper = mount(SettingsGeneralSection);
		const headingTextList = wrapper.findAll('h4').map((heading) => heading.text());
		expect(headingTextList).toContain('Ask before closing');
		expect(headingTextList).not.toContain('Tabs');
		const labelTextList = wrapper
			.findAll('label.check')
			.map((label) => label.text())
			.filter((text) => text.startsWith('Ask before closing'));
		expect(labelTextList).toEqual([
			'Ask before closing a workspace',
			'Ask before closing a tab',
			'Ask before closing a pane',
		]);
	});

	it('links each checkbox to its own setting', async () => {
		const wrapper = mount(SettingsGeneralSection);
		const checkboxList = wrapper
			.findAll('label.check')
			.filter((label) => label.text().startsWith('Ask before closing'))
			.map((label) => label.get('input'));
		await checkboxList[0].setValue(false);
		expect(settings.confirmWorkspaceClose).toBe(false);
		expect(settings.confirmTabClose).toBe(true);
		expect(settings.confirmPaneClose).toBe(true);
		await checkboxList[1].setValue(false);
		expect(settings.confirmTabClose).toBe(false);
		await checkboxList[2].setValue(false);
		expect(settings.confirmPaneClose).toBe(false);
	});
});
