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

	it('asks the Mac for the colors, and paints them in the output', async () => {
		const mac = Fixtures.mac();
		mac.outputText = '\x1b[32mgreen\x1b[0m \x1b[2mdim\x1b[0m \x1b[1;44mbar\x1b[0m\n';
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		expect(mac.callsOf('read').pop()?.params.ansi).toBe(true);
		const output = document.querySelector('.output') as HTMLElement;
		expect(output.textContent).toBe('green dim bar');
		const spans = output.querySelectorAll<HTMLElement>('span');
		expect(spans[0].style.color).toBe('rgb(13, 188, 121)');
		expect(spans[1].classList.contains('a-dim')).toBe(true);
		expect(spans[2].classList.contains('a-bold')).toBe(true);
		expect(spans[2].style.backgroundColor).toBe('rgb(36, 114, 200)');
	});

	it('paints the colors again after a refresh that changes the output', async () => {
		const mac = Fixtures.mac();
		mac.outputText = '\x1b[31mone\x1b[0m';
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-working');
		mac.outputText = '\x1b[34mtwo\x1b[0m';
		await harness.settle(3000);
		const span = document.querySelector<HTMLElement>('.output span');
		expect(span?.textContent).toBe('two');
		expect(span?.style.color).toBe('rgb(36, 114, 200)');
	});

	it('has a refresh icon in the header, and no button Refresh below the output', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.openPane('p-finished');
		const icon = document.querySelector('header button[data-action="refresh"]');
		expect(icon?.getAttribute('aria-label')).toBe('Refresh');
		expect(icon?.textContent?.trim()).toBe('');
		expect(document.querySelectorAll('[data-action="refresh"]')).toHaveLength(1);
		expect(harness.text()).not.toContain('Refresh');
		expect(document.querySelector('.actions')).toBeNull();
		const stateCalls = mac.callsOf('state').length;
		await harness.tap('header button[data-action="refresh"]');
		expect(mac.callsOf('state').length).toBe(stateCalls + 1);
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
