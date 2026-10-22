import { describe, expect, it } from 'vitest';
import type { MacroView } from '../src/mobile_types';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';

const macros: MacroView[] = [
	{
		id: 'progress',
		label: 'Progress',
		description: 'Asks the coding agent where it is',
		source: 'personal',
		text: 'Where are you? Answer in 5 lines.',
	},
	{
		id: 'review',
		label: 'Review the branch',
		description: '',
		source: 'project',
		text: 'Review the branch fix-35.',
	},
];

const computerWithMacros = () => {
	const computer = Fixtures.computer();
	computer.macrosAnswer = {
		macros,
	};
	return computer;
};

describe('Macro button of a pane', () => {
	it('is in the top bar of the screen of one pane', async () => {
		const harness = await AppHarness.start(computerWithMacros());
		await harness.openPane('p-working');
		const button = document.querySelector('header button[data-action="open-macros"]');
		expect(button?.getAttribute('aria-label')).toBe('Macros');
	});

	it('asks the computer for the macros of the open pane, and lists them in a sheet', async () => {
		const computer = computerWithMacros();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-working');
		await harness.tap('[data-action="open-macros"]');
		expect(computer.callsOf('macros').map((call) => call.params)).toEqual([
			{
				paneId: 'p-working',
			},
		]);
		const names = [...harness.overlay.querySelectorAll('.macro .name')].map((name) => name.textContent);
		expect(names).toEqual(['Progress', 'Review the branch']);
		expect(harness.overlay.textContent).toContain('My macro · Asks the coding agent where it is');
	});

	it('writes the text of the macro into the field for a prompt, after the text that is there, and sends nothing', async () => {
		const computer = computerWithMacros();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-working');
		harness.field().value = 'First,';
		await harness.tap('[data-action="open-macros"]');
		await harness.tap('[data-action="insert-macro"][data-index="1"]');
		expect(harness.field().value).toBe('First, Review the branch fix-35.');
		expect(harness.overlay.querySelector('.macro-sheet')).toBeNull();
		expect(computer.callsOf('prompt')).toEqual([]);
		await harness.settle(3000);
		expect(harness.field().value).toBe('First, Review the branch fix-35.');
	});

	it('closes the sheet with the button Cancel, and changes nothing', async () => {
		const harness = await AppHarness.start(computerWithMacros());
		await harness.openPane('p-working');
		await harness.tap('[data-action="open-macros"]');
		await harness.tap('button[data-action="macro-sheet-close"]');
		expect(harness.overlay.querySelector('.macro-sheet')).toBeNull();
		expect(harness.field().value).toBe('');
	});

	it('says that there is no macro when the list is empty', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.openPane('p-working');
		await harness.tap('[data-action="open-macros"]');
		expect(harness.overlay.textContent).toContain('No macro.');
	});
});
