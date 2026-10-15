import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';
import { ScrollSimulator } from './scroll_simulator';

const outputOf = (): HTMLElement => document.querySelector('.output') as HTMLElement;
const mainOf = (): HTMLElement => document.querySelector('main') as HTMLElement;

describe('Scroll', () => {
	beforeEach(() => {
		ScrollSimulator.install();
	});

	afterEach(() => {
		ScrollSimulator.restore();
	});

	it('does not draw a screen again when nothing changed, so the developer can scroll in peace', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		const main = mainOf();
		await harness.settle(4000);
		await harness.settle(4000);
		expect(mainOf()).toBe(main);
	});

	it('starts the output at its end', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.openPane('p-working');
		expect(outputOf().scrollTop).toBe(ScrollSimulator.endOf(outputOf()));
	});

	it('keeps the output where the developer scrolled when the output changes', async () => {
		const computer = Fixtures.computer();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-working');
		outputOf().scrollTop = 100;
		computer.outputText = 'new output';
		await harness.settle(2500);
		expect(outputOf().textContent).toBe('new output');
		expect(outputOf().scrollTop).toBe(100);
	});

	it('keeps the output where the developer scrolled when the output does not change', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.openPane('p-working');
		outputOf().scrollTop = 100;
		await harness.settle(2500);
		await harness.settle(2500);
		expect(outputOf().scrollTop).toBe(100);
	});

	it('follows the end of the output when the developer looks at the end', async () => {
		const computer = Fixtures.computer();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-working');
		outputOf().scrollTop = ScrollSimulator.endOf(outputOf()) - 10;
		computer.outputText = 'new output';
		await harness.settle(2500);
		expect(outputOf().textContent).toBe('new output');
		expect(outputOf().scrollTop).toBe(ScrollSimulator.endOf(outputOf()));
	});

	it('keeps the scroll of a list when the list changes', async () => {
		const computer = Fixtures.computer();
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-screen="panes"]');
		mainOf().scrollTop = 300;
		computer.snapshot.workspaces[0].agents[0].context = 77;
		await harness.settle(4000);
		expect(mainOf().textContent).toContain('77 %');
		expect(mainOf().scrollTop).toBe(300);
	});

	it('starts a new screen at the top', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.tap('button[data-screen="panes"]');
		mainOf().scrollTop = 300;
		await harness.openPane('p-working');
		await harness.tap('.back');
		expect(mainOf().scrollTop).toBe(0);
	});
});
