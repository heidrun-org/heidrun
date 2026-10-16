import { describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { FakeComputer } from './fake_computer';

const terminal = () =>
	FakeComputer.agent({
		paneId: 'p-terminal',
		hasCodingAgent: false,
		name: 'zsh',
		kind: 'Terminal',
		tab: 'shell',
		status: 'unknown',
		since: null,
		context: null,
	});

const computerWithTerminal = () => {
	const computer = new FakeComputer(
		FakeComputer.snapshotOf([FakeComputer.agent({}), terminal()], []),
	);
	computer.outputText = 'jerome@computer $ git status\nclean\n';
	return computer;
};

describe('Plain terminal', () => {
	it('is listed on the Panes screen with the badge Terminal, next to the coding agents', async () => {
		const harness = await AppHarness.start(computerWithTerminal());
		await harness.tap('button[data-screen="panes"]');
		const rows = [...document.querySelectorAll<HTMLElement>('.list .card')];
		expect(rows.map((row) => row.dataset.paneId)).toEqual(['p-1', 'p-terminal']);
		expect(rows[1].querySelector('.badge')?.textContent).toBe('Terminal');
		expect(rows[1].querySelector('.dot-idle')).not.toBeNull();
	});

	it('shows its output on its screen, and nothing that writes to it', async () => {
		const computer = computerWithTerminal();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-terminal');
		expect(document.querySelector('header h1')?.textContent).toBe('heidrun · shell');
		expect(document.querySelector('header .badge')?.textContent).toBe('Terminal');
		expect(document.querySelector('.output')?.textContent).toBe('jerome@computer $ git status\nclean');
		expect(harness.text()).toContain('The phone only reads a terminal.');
		for (const selector of [
			'#prompt-field',
			'[data-action="send"]',
			'[data-action="voice"]',
			'[data-action="open-macros"]',
			'[data-action="interrupt"]',
			'[data-action="deny"]',
		]) {
			expect(document.querySelector(selector), selector).toBeNull();
		}
		expect(computer.callsOf('read').pop()?.params.paneId).toBe('p-terminal');
	});

	it('keeps the output fresh with a refresh', async () => {
		const computer = computerWithTerminal();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-terminal');
		computer.outputText = 'a new line\n';
		await harness.settle(3000);
		expect(document.querySelector('.output')?.textContent).toBe('a new line');
	});

	it('does not count in the Dashboard, and is not in the Needs you screen', async () => {
		const harness = await AppHarness.start(computerWithTerminal(), true, '#/dashboard');
		expect(harness.text()).toContain('1 coding agent in 1 workspace');
		await harness.tap('button[data-screen="needs_you"]');
		expect(document.querySelector('[data-pane-id="p-terminal"]')).toBeNull();
	});

	it('does not need a coding agent to open it by its address', async () => {
		await AppHarness.start(computerWithTerminal(), true, '#/panes/p-terminal');
		expect(document.querySelector('.output')?.textContent).toContain('git status');
	});
});
