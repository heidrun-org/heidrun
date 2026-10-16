import { describe, expect, it } from 'vitest';
import type { MacroView } from '../src/mobile_types';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';

const personalMacro: MacroView = {
	id: 'progress',
	label: 'Progress',
	description: 'Asks the coding agent where it is',
	source: 'personal',
	workspaceId: null,
	workspace: null,
};

const projectMacro: MacroView = {
	id: 'review',
	label: 'Review the branch',
	description: '',
	source: 'project',
	workspaceId: 'w-1',
	workspace: 'heidrun',
};

const computerWithMacros = () => {
	const computer = Fixtures.computer();
	computer.macrosAnswer = {
		macros: [personalMacro, projectMacro],
	};
	return computer;
};

describe('Macros screen', () => {
	it('lists the personal macros, then the macros of each project', async () => {
		const harness = await AppHarness.start(computerWithMacros(), true, '#/macros');
		expect(document.querySelector('header h1')?.textContent).toBe('Macros');
		const groups = [...document.querySelectorAll('.eyebrow')].map((group) => group.textContent);
		expect(groups).toEqual(['My macros', 'Project · heidrun']);
		const names = [...document.querySelectorAll('.macro .name')].map((name) => name.textContent);
		expect(names).toEqual(['Progress', 'Review the branch']);
		expect(harness.text()).toContain('Asks the coding agent where it is');
	});

	it('says that there is no macro when the list is empty', async () => {
		const harness = await AppHarness.start(Fixtures.computer(), true, '#/macros');
		expect(harness.text()).toContain('No macro.');
	});

	it('shows the panes after a tap on a macro, with the blocked coding agent disabled', async () => {
		const harness = await AppHarness.start(computerWithMacros(), true, '#/macros');
		await harness.tap('[data-action="pick-macro"][data-macro-key="personal::progress"]');
		expect(harness.text()).toContain('Send the macro “Progress” to');
		const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-action="send-macro"]')];
		expect(rows.map((row) => row.dataset.paneId)).toEqual(['p-working', 'p-finished', 'p-asking', 'p-blocked']);
		expect(rows.find((row) => row.dataset.paneId === 'p-blocked')?.disabled).toBe(true);
		await harness.tap('[data-action="cancel-macro"]');
		expect(document.querySelectorAll('.macro')).toHaveLength(2);
	});

	it('sends the macro as a prompt with its source, then opens the pane', async () => {
		const computer = computerWithMacros();
		const harness = await AppHarness.start(computer, true, '#/macros');
		await harness.tap('[data-action="pick-macro"][data-macro-key="project:w-1:review"]');
		await harness.tap('[data-action="send-macro"][data-pane-id="p-working"]');
		expect(computer.callsOf('prompt').map((call) => call.params)).toEqual([
			{
				paneId: 'p-working',
				macroId: 'review',
				macroSource: 'project',
				macroWorkspaceId: 'w-1',
			},
		]);
		expect(harness.toast()).toBe('Macro sent: Review the branch');
		expect(window.location.hash).toBe('#/macros/p-working');
		expect(document.querySelector('header h1')?.textContent).toBe('heidrun · fix-35');
	});

	it('asks to check a dangerous command of a macro, like a typed prompt', async () => {
		const computer = computerWithMacros();
		computer.answers.prompt = [
			{
				confirm: {
					command: 'rm -rf build',
					why: 'deletes files',
				},
			},
			{
				ok: true,
			},
		];
		const harness = await AppHarness.start(computer, true, '#/macros');
		await harness.tap('[data-action="pick-macro"][data-macro-key="personal::progress"]');
		await harness.tap('[data-action="send-macro"][data-pane-id="p-working"]');
		expect(harness.overlay.querySelector('.sheet')?.textContent).toContain('rm -rf build');
		await harness.tap('[data-action="sheet-confirm"]');
		expect(computer.callsOf('prompt').pop()?.params).toMatchObject({
			macroId: 'progress',
			confirmed: true,
			command: 'rm -rf build',
		});
	});
});
