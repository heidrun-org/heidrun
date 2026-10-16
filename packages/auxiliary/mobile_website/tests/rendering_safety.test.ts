import { describe, expect, it } from 'vitest';
import type { AgentView } from '../src/mobile_types';
import { AppHarness } from './app_harness';
import { FakeComputer } from './fake_computer';

const attack = '<img src=x onerror=alert(1)>';

/**
 * Lists every problem that a strict content security policy (no inline script, no inline style) would block.
 * @param container The element to look at.
 * @returns One text for each problem.
 */
const problemsOf = (container: HTMLElement): string[] => {
	const problems: string[] = [];
	for (const element of container.querySelectorAll('*')) {
		if (element.tagName === 'SCRIPT') {
			problems.push('script element');
		}
		for (const attribute of element.attributes) {
			const isPaintedColor = element.hasAttribute('data-fg') || element.hasAttribute('data-bg');
			if (attribute.name === 'style' && isPaintedColor === false) {
				problems.push(`style attribute on ${element.tagName}`);
			}
			if (attribute.name.startsWith('on')) {
				problems.push(`${attribute.name} attribute on ${element.tagName}`);
			}
			if (attribute.value.trim().toLowerCase().startsWith('javascript:')) {
				problems.push(`javascript address on ${element.tagName}`);
			}
		}
	}
	return problems;
};

const hostileAgent = (): AgentView =>
	FakeComputer.agent({
		paneId: 'p-hostile',
		name: attack,
		workspace: attack,
		tab: attack,
		status: 'blocked',
		menu: {
			question: attack,
			detail: attack,
			options: [
				{
					n: 1,
					label: attack,
				},
			],
		},
	});

describe('Rendering safety', () => {
	it('puts the text of a coding agent in the page as text, never as markup', async () => {
		const computer = new FakeComputer(FakeComputer.snapshotOf([hostileAgent()], ['p-hostile']));
		computer.outputText = attack;
		const harness = await AppHarness.start(computer);
		expect(document.querySelector('img')).toBeNull();
		expect(harness.text()).toContain(attack);
		await harness.tap('button[data-screen="panes"]');
		expect(document.querySelector('img')).toBeNull();
		expect(harness.text()).toContain(attack);
		await harness.openPane('p-hostile');
		expect(document.querySelector('img')).toBeNull();
		expect(document.querySelector('.output')?.textContent).toBe(attack);
		expect(problemsOf(harness.root)).toEqual([]);
	});

	it('puts a hostile text inside a colored span as text, and the color only as a hexadecimal value', async () => {
		const computer = new FakeComputer(FakeComputer.snapshotOf([hostileAgent()], ['p-hostile']));
		computer.outputText = `\x1b[38;2;1;2;3m${attack}\x1b[0m \x1b[38;5;"onmouseover="x\x1b[0m`;
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-hostile');
		expect(document.querySelector('img')).toBeNull();
		const colored = document.querySelectorAll('.output [data-fg]');
		expect(colored).toHaveLength(1);
		expect(colored[0].getAttribute('data-fg')).toBe('#010203');
		expect(colored[0].textContent).toBe(attack);
		expect(problemsOf(harness.root)).toEqual([]);
	});

	it('shows a message of the computer as text, never as markup', async () => {
		const computer = new FakeComputer(FakeComputer.snapshotOf([hostileAgent()], ['p-hostile']));
		computer.answers.answer = [{ error: attack }];
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-action="answer"]');
		expect(harness.toast()).toBe(attack);
		expect(harness.overlay.querySelector('img')).toBeNull();
	});

	it('shows a command to check as text, never as markup', async () => {
		const computer = new FakeComputer(FakeComputer.snapshotOf([hostileAgent()], ['p-hostile']));
		computer.answers.answer = [
			{
				confirm: {
					command: attack,
					why: attack,
				},
			},
		];
		const harness = await AppHarness.start(computer);
		await harness.tap('button[data-action="answer"]');
		expect(harness.overlay.querySelector('.sheet')?.textContent).toContain(attack);
		expect(harness.overlay.querySelector('img')).toBeNull();
		expect(problemsOf(harness.overlay)).toEqual([]);
	});

	it('puts the texts of the macros and of the launchers in the page as text, never as markup', async () => {
		const computer = new FakeComputer(FakeComputer.snapshotOf([hostileAgent()], ['p-hostile']));
		computer.macrosAnswer = {
			macros: [
				{
					id: attack,
					label: attack,
					description: attack,
					source: 'project',
					workspaceId: attack,
					workspace: attack,
				},
			],
		};
		computer.launchersAnswer = {
			workspaces: [
				{
					id: attack,
					label: attack,
					error: attack,
					launchers: [
						{
							id: attack,
							label: attack,
							description: null,
							command: attack,
							status: 'idle',
						},
					],
				},
			],
		};
		const harness = await AppHarness.start(computer, true, '#/macros');
		expect(document.querySelector('img')).toBeNull();
		expect(harness.text()).toContain(attack);
		await harness.tap('[data-action="pick-macro"]');
		expect(document.querySelector('img')).toBeNull();
		expect(problemsOf(harness.root)).toEqual([]);
		await harness.tap('button[data-screen="launchers"]');
		expect(document.querySelector('img')).toBeNull();
		expect(harness.text()).toContain(attack);
		expect(problemsOf(harness.root)).toEqual([]);
	});

	it('uses no inline script, no inline style, and no event attribute on any screen', async () => {
		const agents = [hostileAgent(), FakeComputer.agent({})];
		const computer = new FakeComputer(FakeComputer.snapshotOf(agents, ['p-hostile']));
		const harness = await AppHarness.start(computer);
		const screens = ['dashboard', 'needs_you', 'panes', 'macros', 'launchers'];
		for (const screen of screens) {
			await harness.tap(`button[data-screen="${screen}"]`);
			expect(problemsOf(harness.root), screen).toEqual([]);
		}
		await harness.tap('button[data-screen="panes"]');
		await harness.openPane('p-1');
		expect(problemsOf(harness.root)).toEqual([]);
	});
});
