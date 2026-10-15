import { describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { FakeMac } from './fake_mac';
import { Fixtures } from './fixtures';

describe('Pane screen', () => {
	it('shows the end of the output, the status, and the context of the coding agent', async () => {
		const mac = Fixtures.mac();
		mac.outputText = 'line one\nline two\n\n\n';
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		expect(document.querySelector('.output')?.textContent).toBe('line one\nline two');
		expect(document.querySelector('header .badge')?.textContent).toBe('Working');
		expect(harness.text()).toContain('Codex · context 42 % · 2 min ago');
	});

	it('shows the menu of a blocked coding agent, and answers it', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-blocked');
		expect(document.querySelectorAll('.menu button[data-action="answer"]')).toHaveLength(3);
		await harness.tap('.menu button[data-n="3"]');
		expect(mac.callsOf('answer').map((call) => call.params)).toEqual([
			{
				paneId: 'p-blocked',
				n: 3,
			},
		]);
	});

	it('tells to read the output when a blocked coding agent has no menu', async () => {
		const mac = Fixtures.mac();
		mac.snapshot.workspaces[0].agents[3].menu = null;
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-blocked');
		expect(harness.text()).toContain('Waiting for a decision: read the end of the output below.');
		expect(document.querySelectorAll('.menu button')).toHaveLength(0);
	});

	it('shows the question of a coding agent that finished and asks something', async () => {
		const harness = await AppHarness.start(Fixtures.mac());
		await harness.openPane('p-asking');
		expect(document.querySelector('main .question')?.textContent).toBe('Which file should I change?');
	});

	it('refreshes the output every 2.5 seconds', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		const before = mac.callsOf('read').length;
		mac.outputText = 'new output';
		await harness.settle(2500);
		expect(mac.callsOf('read').length).toBe(before + 1);
		expect(document.querySelector('.output')?.textContent).toBe('new output');
	});

	it('says that the coding agent does not exist anymore when it leaves the list', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		mac.snapshot.workspaces[0].agents = [];
		await harness.settle(2500);
		expect(harness.text()).toContain('This coding agent does not exist anymore.');
		expect(document.querySelector('#prompt-field')).toBeNull();
	});
});

describe('Pane screen prompt', () => {
	it('sends the prompt without the spaces around it, clears the field, and says so', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		harness.field().value = '  run the tests  ';
		await harness.tap('button[data-action="send"]');
		expect(mac.callsOf('prompt').map((call) => call.params)).toEqual([
			{
				paneId: 'p-working',
				text: 'run the tests',
			},
		]);
		expect(harness.field().value).toBe('');
		expect(harness.toast()).toBe('Prompt sent');
	});

	it('sends nothing when the field is empty or has only spaces', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		await harness.tap('button[data-action="send"]');
		harness.field().value = '   ';
		await harness.tap('button[data-action="send"]');
		expect(mac.callsOf('prompt')).toHaveLength(0);
	});

	it('keeps the text of the prompt when the Mac refuses it', async () => {
		const mac = Fixtures.mac();
		mac.answers.prompt = [{ error: 'The coding agent is busy.' }];
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		harness.field().value = 'run the tests';
		await harness.tap('button[data-action="send"]');
		expect(harness.field().value).toBe('run the tests');
		expect(harness.toast()).toBe('The coding agent is busy.');
	});

	it('does not draw the screen again while the developer types, so the text stays', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		const field = harness.field();
		field.focus();
		field.value = 'half a sen';
		mac.outputText = 'new output';
		await harness.settle(2500);
		expect(harness.field()).toBe(field);
		expect(field.value).toBe('half a sen');
		field.blur();
		await harness.settle(2500);
		expect(document.querySelector('.output')?.textContent).toBe('new output');
	});
});

describe('Pane screen keys', () => {
	it('has the button Interrupt for a working coding agent, and sends Esc', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		expect(document.querySelector('button[data-action="deny"]')).toBeNull();
		await harness.tap('button[data-action="interrupt"]');
		expect(mac.callsOf('keys').map((call) => call.params)).toEqual([
			{
				paneId: 'p-working',
				action: 'interrupt',
			},
		]);
		expect(harness.toast()).toBe('Interrupted (Esc)');
	});

	it('has the button Refuse for a blocked coding agent, and sends Esc', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-blocked');
		expect(document.querySelector('button[data-action="interrupt"]')).toBeNull();
		await harness.tap('button[data-action="deny"]');
		expect(mac.callsOf('keys').map((call) => call.params)).toEqual([
			{
				paneId: 'p-blocked',
				action: 'deny',
			},
		]);
		expect(harness.toast()).toBe('Refused (Esc)');
	});

	it('has neither button for a coding agent that finished', async () => {
		const harness = await AppHarness.start(Fixtures.mac());
		await harness.openPane('p-finished');
		expect(document.querySelector('button[data-action="interrupt"]')).toBeNull();
		expect(document.querySelector('button[data-action="deny"]')).toBeNull();
	});

	it('says that the Mac does not answer when the call fails', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		mac.isDown = true;
		await harness.tap('button[data-action="interrupt"]');
		expect(harness.toast()).toBe('No answer from the Mac: Failed to fetch');
	});

	it('asks for the pairing again when the Mac refuses the key during a call', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		mac.acceptedKey = FakeMac.key.replace(/a/g, 'c');
		await harness.tap('button[data-action="interrupt"]');
		expect(harness.text()).toContain('Pairing needed');
	});
});
