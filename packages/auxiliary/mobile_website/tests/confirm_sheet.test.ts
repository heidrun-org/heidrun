import { describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';

const dangerousCommand = {
	command: 'rm -rf build',
	why: 'The command deletes files.',
};

describe('Confirmation sheet', () => {
	it('shows the command and the reason, and sends nothing more until the developer decides', async () => {
		const computer = Fixtures.computer();
		computer.answers.answer = [{ confirm: dangerousCommand }];
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-action="answer"][data-n="1"]');
		const sheet = harness.overlay.querySelector('.sheet');
		expect(sheet?.textContent).toContain('rm -rf build');
		expect(sheet?.textContent).toContain('The command deletes files.');
		expect(computer.callsOf('answer')).toHaveLength(1);
	});

	it('does nothing more when the developer cancels', async () => {
		const computer = Fixtures.computer();
		computer.answers.answer = [{ confirm: dangerousCommand }];
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-action="answer"][data-n="1"]');
		await harness.tap('.sheet button[data-action="sheet-cancel"]');
		expect(harness.overlay.querySelector('.sheet')).toBeNull();
		expect(computer.callsOf('answer')).toHaveLength(1);
		expect(harness.toast()).toBeNull();
	});

	it('does nothing more when the developer taps outside the box of the sheet', async () => {
		const computer = Fixtures.computer();
		computer.answers.answer = [{ confirm: dangerousCommand }];
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-action="answer"][data-n="1"]');
		await harness.tap('.sheet');
		expect(harness.overlay.querySelector('.sheet')).toBeNull();
		expect(computer.callsOf('answer')).toHaveLength(1);
	});

	it('keeps the sheet when the developer taps inside the box, on the text', async () => {
		const computer = Fixtures.computer();
		computer.answers.answer = [{ confirm: dangerousCommand }];
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-action="answer"][data-n="1"]');
		await harness.tap('.sheet h2');
		expect(harness.overlay.querySelector('.sheet')).not.toBeNull();
	});

	it('sends the same call again with the confirmed command when the developer confirms', async () => {
		const computer = Fixtures.computer();
		computer.answers.answer = [{ confirm: dangerousCommand }, { ok: true }];
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-action="answer"][data-n="1"]');
		await harness.tap('.sheet button[data-action="sheet-confirm"]');
		expect(computer.callsOf('answer').map((call) => call.params)).toEqual([
			{
				paneId: 'p-blocked',
				n: 1,
			},
			{
				paneId: 'p-blocked',
				n: 1,
				confirmed: true,
				command: 'rm -rf build',
			},
		]);
		expect(harness.overlay.querySelector('.sheet')).toBeNull();
		expect(harness.toast()).toBe('Answer sent');
	});

	it('refuses to go on when the computer asks for a confirmation a second time', async () => {
		const computer = Fixtures.computer();
		computer.answers.answer = [{ confirm: dangerousCommand }, { confirm: dangerousCommand }];
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-action="answer"][data-n="1"]');
		await harness.tap('.sheet button[data-action="sheet-confirm"]');
		expect(harness.toast()).toBe('The command changed in the meantime: check it again');
	});

	it('shows the error text of the computer as a message', async () => {
		const computer = Fixtures.computer();
		computer.answers.answer = [{ error: 'This pane does not wait for an answer.' }];
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-action="answer"][data-n="1"]');
		expect(harness.toast()).toBe('This pane does not wait for an answer.');
	});
});
