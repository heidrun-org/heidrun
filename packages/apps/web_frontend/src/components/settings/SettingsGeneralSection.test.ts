import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsGeneralSection from './SettingsGeneralSection.vue';
import { settings } from '../../stores/settings';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsGeneralSectionTest — the section General holds the language, the time format, the working days, and the goat sound
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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

describe('goat sound', () => {
	beforeEach(() => {
		settings.language = 'en';
		settings.goatSound = false;
	});

	it('shows the heading Sound, and a Bootstrap switch labelled "Enable goat sound" that is off by default', () => {
		const wrapper = mount(SettingsGeneralSection);
		expect(wrapper.findAll('h4').map((heading) => heading.text())).toContain('Sound');
		const switchInput = wrapper.get('input[type=checkbox][role=switch]');
		expect(wrapper.get(`label[for="${switchInput.attributes('id')}"]`).text()).toBe('Enable goat sound');
		expect((switchInput.element as HTMLInputElement).checked).toBe(false);
	});

	it('puts the switch after the working days', () => {
		const wrapper = mount(SettingsGeneralSection);
		const headings = wrapper.findAll('h4').map((heading) => heading.text());
		expect(headings).toEqual(['Language', 'Time format', 'Working days', 'Sound']);
	});

	it('saves the setting when the switch changes, in both directions', async () => {
		const wrapper = mount(SettingsGeneralSection);
		const switchInput = wrapper.get('input[type=checkbox][role=switch]');
		await switchInput.setValue(true);
		expect(settings.goatSound).toBe(true);
		await switchInput.setValue(false);
		expect(settings.goatSound).toBe(false);
	});

	it('shows the switch as on when the setting is on', () => {
		settings.goatSound = true;
		const wrapper = mount(SettingsGeneralSection);
		expect((wrapper.get('input[type=checkbox][role=switch]').element as HTMLInputElement).checked).toBe(true);
	});

	it('shows the label of the switch in French when the language is French', () => {
		settings.language = 'fr';
		const wrapper = mount(SettingsGeneralSection);
		const switchInput = wrapper.get('input[type=checkbox][role=switch]');
		expect(wrapper.get(`label[for="${switchInput.attributes('id')}"]`).text()).toBe('Activer le son de la chèvre');
		expect(wrapper.findAll('h4').map((heading) => heading.text())).toContain('Son');
	});
});
