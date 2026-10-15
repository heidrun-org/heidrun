import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsGeneralSection from './SettingsGeneralSection.vue';
import { settings } from '../../stores/settings';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsGeneralSectionTest — every control of the section General is a Bootstrap form component
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of `SettingsGeneralSection.vue`.
 */
class SettingsGeneralSectionTestHelper {
	/**
	 * Finds the switch row whose label has the given text.
	 *
	 * @param wrapper - The mounted section.
	 * @param labelText - The text of the label of the switch.
	 * @returns The switch input of the row.
	 */
	static getSwitch(wrapper: ReturnType<typeof mount>, labelText: string) {
		const label = wrapper.findAll('label').find((candidate) => candidate.text() === labelText);
		if (label === undefined) {
			throw new Error(`The switch "${labelText}" is missing.`);
		}
		return wrapper.get(`input[id="${label.attributes('for')}"]`);
	}
}

describe('language and time format', () => {
	beforeEach(() => {
		settings.language = 'en';
		settings.timeFormat = 'auto';
	});

	it('shows the languages as a Bootstrap button group of radio inputs, with the current language checked', () => {
		const wrapper = mount(SettingsGeneralSection);
		const group = wrapper.findAll('.btn-group')[0];
		expect(group.attributes('aria-label')).toBe('Language');
		expect(group.findAll('label').map((label) => label.text())).toEqual(['English', 'Français']);
		expect(group.findAll('input[type=radio]').map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([true, false]);
	});

	it('saves the language of the radio input that is chosen', async () => {
		const wrapper = mount(SettingsGeneralSection);
		await wrapper.findAll('.btn-group')[0].findAll('input[type=radio]')[1].setValue(true);
		expect(settings.language).toBe('fr');
	});

	it('shows the three time formats as a Bootstrap button group of radio inputs, and saves the one that is chosen', async () => {
		const wrapper = mount(SettingsGeneralSection);
		const group = wrapper.findAll('.btn-group')[1];
		expect(group.findAll('label').map((label) => label.text())).toEqual(['Automatic', '12-hour (AM / PM)', '24-hour']);
		await group.findAll('input[type=radio]')[2].setValue(true);
		expect(settings.timeFormat).toBe('24h');
	});
});

describe('working days', () => {
	beforeEach(() => {
		settings.workingDays = [1, 2, 3, 4, 5];
	});

	it('shows seven checkbox inputs in a Bootstrap button group, from Monday to Sunday, with the working days checked', () => {
		const wrapper = mount(SettingsGeneralSection);
		const group = wrapper.findAll('.btn-group')[2];
		expect(group.findAll('label').map((label) => label.text())).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
		const checkboxes = group.findAll('input[type=checkbox]');
		expect(checkboxes.map((checkbox) => (checkbox.element as HTMLInputElement).checked)).toEqual([true, true, true, true, true, false, false]);
	});

	it('adds a day and removes a day, and keeps the days in the order of the week', async () => {
		const wrapper = mount(SettingsGeneralSection);
		const checkboxes = wrapper.findAll('.btn-group')[2].findAll('input[type=checkbox]');
		await checkboxes[6].setValue(true);
		expect(settings.workingDays).toEqual([0, 1, 2, 3, 4, 5]);
		await checkboxes[0].setValue(false);
		expect(settings.workingDays).toEqual([0, 2, 3, 4, 5]);
	});

	it('keeps the last working day checked', async () => {
		settings.workingDays = [3];
		const wrapper = mount(SettingsGeneralSection);
		const checkbox = wrapper.findAll('.btn-group')[2].findAll('input[type=checkbox]')[2];
		await checkbox.setValue(false);
		expect(settings.workingDays).toEqual([3]);
		expect((checkbox.element as HTMLInputElement).checked).toBe(true);
	});
});

describe('heading Ask before closing', () => {
	beforeEach(() => {
		settings.confirmWorkspaceClose = true;
		settings.confirmTabClose = true;
		settings.confirmPaneClose = true;
	});

	it('replaces the heading Tabs, and holds three switches: workspace, then tab, then pane', () => {
		const wrapper = mount(SettingsGeneralSection);
		const headingTextList = wrapper.findAll('h4').map((heading) => heading.text());
		expect(headingTextList).toContain('Ask before closing');
		expect(headingTextList).not.toContain('Tabs');
		const labelTextList = wrapper
			.findAll('label')
			.map((label) => label.text())
			.filter((text) => text.startsWith('Ask before closing'));
		expect(labelTextList).toEqual([
			'Ask before closing a workspace',
			'Ask before closing a tab',
			'Ask before closing a pane',
		]);
	});

	it('links each switch to its own setting', async () => {
		const wrapper = mount(SettingsGeneralSection);
		const switchList = [
			SettingsGeneralSectionTestHelper.getSwitch(wrapper, 'Ask before closing a workspace'),
			SettingsGeneralSectionTestHelper.getSwitch(wrapper, 'Ask before closing a tab'),
			SettingsGeneralSectionTestHelper.getSwitch(wrapper, 'Ask before closing a pane'),
		];
		await switchList[0].setValue(false);
		expect(settings.confirmWorkspaceClose).toBe(false);
		expect(settings.confirmTabClose).toBe(true);
		expect(settings.confirmPaneClose).toBe(true);
		await switchList[1].setValue(false);
		expect(settings.confirmTabClose).toBe(false);
		await switchList[2].setValue(false);
		expect(settings.confirmPaneClose).toBe(false);
	});
});

describe('heading Ask before deleting', () => {
	beforeEach(() => {
		settings.confirmSavedSearchDelete = true;
	});

	it('holds the switch Ask before deleting a saved search, linked to its setting, after the heading Ask before closing', async () => {
		const wrapper = mount(SettingsGeneralSection);
		const headingTextList = wrapper.findAll('h4').map((heading) => heading.text());
		expect(headingTextList.indexOf('Ask before deleting')).toBe(headingTextList.indexOf('Ask before closing') + 1);
		const switchInput = SettingsGeneralSectionTestHelper.getSwitch(wrapper, 'Ask before deleting a saved search');
		expect(switchInput.attributes('role')).toBe('switch');
		expect((switchInput.element as HTMLInputElement).checked).toBe(true);
		await switchInput.setValue(false);
		expect(settings.confirmSavedSearchDelete).toBe(false);
	});
});

describe('switch Keep agents running after quit', () => {
	beforeEach(() => {
		settings.keepAgentsRunningAfterQuit = false;
	});

	it('is a Bootstrap switch, switched off by default, under the heading of the quit', async () => {
		const wrapper = mount(SettingsGeneralSection);
		expect(wrapper.findAll('h4').map((heading) => heading.text())).toContain('Quit');
		const switchInput = SettingsGeneralSectionTestHelper.getSwitch(wrapper, 'Keep agents running after quit');
		expect(switchInput.element.parentElement?.classList.contains('switch')).toBe(true);
		expect((switchInput.element as HTMLInputElement).checked).toBe(false);
		await switchInput.setValue(true);
		expect(settings.keepAgentsRunningAfterQuit).toBe(true);
	});

	it('explains itself in an information card that opens from a circled question mark just after the label', async () => {
		const wrapper = mount(SettingsGeneralSection);
		const mark = wrapper.get('.information-card-part');
		expect(mark.get('[role="img"]').attributes('aria-label')).toBe('What does this setting do?');
		expect(wrapper.find('.popover').exists()).toBe(false);
		await mark.trigger('click');
		const card = wrapper.get('.popover');
		expect(card.classes()).toContain('bs-popover-bottom');
		expect(card.text()).toContain('Heidrun stops its Herdr session');
	});

	it('does not switch when the question mark is clicked', async () => {
		const wrapper = mount(SettingsGeneralSection);
		await wrapper.get('.information-card-part').trigger('click');
		expect(settings.keepAgentsRunningAfterQuit).toBe(false);
	});
});

describe('fetch in the background', () => {
	beforeEach(() => {
		settings.gitFetchMinutes = 5;
	});

	it('shows the heading Git last, then the name of the option, then a Bootstrap button group of five radio inputs', () => {
		const wrapper = mount(SettingsGeneralSection);
		const headings = wrapper.findAll('h4').map((heading) => heading.text());
		expect(headings[headings.length - 1]).toBe('Git');
		const group = wrapper.findAll('.btn-group')[3];
		expect(group.attributes('aria-label')).toBe('Fetch the remote repository in the background');
		expect(group.element.previousElementSibling?.textContent).toBe('Fetch the remote repository in the background');
		expect(group.findAll('label').map((label) => label.text())).toEqual(['Off', '1 minute', '5 minutes', '10 minutes', '30 minutes']);
		for (const label of group.findAll('label')) {
			expect(label.classes()).toEqual(expect.arrayContaining(['btn-check', 'btn-outline', 'theme-secondary']));
		}
		expect(group.findAll('input[type=radio]')).toHaveLength(5);
	});

	it('checks the radio input of 5 minutes, which is the default', () => {
		const wrapper = mount(SettingsGeneralSection);
		const radios = wrapper.findAll('.btn-group')[3].findAll('input[type=radio]');
		expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, false, true, false, false]);
	});

	it('saves the delay, in minutes, of the radio input that is chosen, and 0 for Off', async () => {
		const wrapper = mount(SettingsGeneralSection);
		const radios = wrapper.findAll('.btn-group')[3].findAll('input[type=radio]');
		await radios[4].setValue(true);
		expect(settings.gitFetchMinutes).toBe(30);
		await radios[1].setValue(true);
		expect(settings.gitFetchMinutes).toBe(1);
		await radios[0].setValue(true);
		expect(settings.gitFetchMinutes).toBe(0);
	});

	it('checks the radio input of the saved delay', () => {
		settings.gitFetchMinutes = 10;
		const wrapper = mount(SettingsGeneralSection);
		const radios = wrapper.findAll('.btn-group')[3].findAll('input[type=radio]');
		expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, false, false, true, false]);
	});

	it('explains in one line that the counts of the Git branch section stay true, and that a failed fetch shows nothing', () => {
		const wrapper = mount(SettingsGeneralSection);
		const help = wrapper.findAll('.form-text').map((line) => line.text()).find((text) => text.includes('git fetch'));
		expect(help).toContain('the two counts of the Git branch section of the status bar stay true');
		expect(help).toContain('A fetch that fails shows nothing');
	});
});
