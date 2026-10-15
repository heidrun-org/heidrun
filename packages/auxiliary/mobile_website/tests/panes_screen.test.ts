import { describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { FakeComputer } from './fake_computer';
import { Fixtures } from './fixtures';

describe('Panes screen', () => {
	it('lists every coding agent, grouped by workspace and by tab', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.tap('button[data-screen="panes"]');
		expect(document.querySelector('header h1')?.textContent).toBe('Panes');
		expect(document.querySelector('.eyebrow')?.textContent).toBe('heidrun');
		const tabs = [...document.querySelectorAll('.tab-title')].map((title) => title.textContent);
		expect(tabs).toEqual(['fix-35', 'docs', 'review-12']);
		const cards = [...document.querySelectorAll<HTMLElement>('.list .card')];
		const rows = cards.map((card) => card.dataset.paneId);
		expect(rows).toEqual(['p-working', 'p-blocked', 'p-finished', 'p-asking']);
	});

	it('shows the context used by each coding agent', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.tap('button[data-screen="panes"]');
		expect(document.querySelector('.list .card .badge')?.textContent).toBe('42 %');
	});

	it('says that no pane runs a coding agent when the list is empty', async () => {
		const computer = new FakeComputer({
			now: 1_000_000,
			attention: [],
			workspaces: [],
			quotas: [],
		});
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-screen="panes"]');
		expect(harness.text()).toContain('No pane runs a coding agent.');
	});

	it('opens the pane of a coding agent, and the button Back returns to the list of panes', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.tap('button[data-screen="panes"]');
		await harness.openPane('p-working');
		expect(document.querySelector('header h1')?.textContent).toBe('heidrun · fix-35');
		await harness.tap('.back');
		expect(document.querySelector('header h1')?.textContent).toBe('Panes');
		expect(document.querySelector('.bar-button-active')?.textContent).toContain('Panes');
	});
});

describe('Bottom bar', () => {
	it('has the five buttons, with Dashboard highlighted on the dashboard', async () => {
		await AppHarness.start(Fixtures.computer(), true, '#/dashboard');
		const buttons = [...document.querySelectorAll('.bar-button')];
		const labels = buttons.map((button) => button.textContent?.trim());
		expect(labels).toEqual(['Dashboard', 'Needs you', 'Panes', 'Macros', 'Launchers']);
		expect(document.querySelector('.bar-button-active')?.textContent).toContain('Dashboard');
		expect(document.querySelector('.bar-button-active')?.getAttribute('aria-current')).toBe('page');
	});

	it('highlights the screen that is open', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.tap('button[data-screen="panes"]');
		expect(document.querySelectorAll('.bar-button-active')).toHaveLength(1);
		expect(document.querySelector('.bar-button-active')?.textContent).toContain('Panes');
	});

	it('opens the screens Macros and Launchers, which say that they come later', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.tap('button[data-screen="macros"]');
		expect(harness.text()).toContain('The macros come in a later version.');
		await harness.tap('button[data-screen="launchers"]');
		expect(harness.text()).toContain('The launchers come in a later version.');
		await harness.tap('button[data-screen="needs_you"]');
		expect(harness.text()).toContain('Run this command?');
	});

	it('is not shown before the first answer of the computer', async () => {
		const computer = Fixtures.computer();
		computer.isDown = true;
		const harness = await AppHarness.start(computer);
		expect(document.querySelector('.bottom-bar')).toBeNull();
		expect(harness.text()).toContain('The computer does not answer');
	});
});
