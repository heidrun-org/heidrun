import { describe, expect, it } from 'vitest';
import type { AgentView } from '../src/mobile_types';
import { AppHarness } from './app_harness';
import { FakeMac } from './fake_mac';

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
			if (attribute.name === 'style') {
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
	FakeMac.agent({
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
		const mac = new FakeMac(FakeMac.snapshotOf([hostileAgent()], ['p-hostile']));
		mac.outputText = attack;
		const harness = await AppHarness.start(mac);
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

	it('shows a message of the Mac as text, never as markup', async () => {
		const mac = new FakeMac(FakeMac.snapshotOf([hostileAgent()], ['p-hostile']));
		mac.answers.answer = [{ error: attack }];
		const harness = await AppHarness.start(mac);
		await harness.tap('button[data-action="answer"]');
		expect(harness.toast()).toBe(attack);
		expect(harness.overlay.querySelector('img')).toBeNull();
	});

	it('shows a command to check as text, never as markup', async () => {
		const mac = new FakeMac(FakeMac.snapshotOf([hostileAgent()], ['p-hostile']));
		mac.answers.answer = [
			{
				confirm: {
					command: attack,
					why: attack,
				},
			},
		];
		const harness = await AppHarness.start(mac);
		await harness.tap('button[data-action="answer"]');
		expect(harness.overlay.querySelector('.sheet')?.textContent).toContain(attack);
		expect(harness.overlay.querySelector('img')).toBeNull();
		expect(problemsOf(harness.overlay)).toEqual([]);
	});

	it('uses no inline script, no inline style, and no event attribute on any screen', async () => {
		const mac = new FakeMac(FakeMac.snapshotOf([hostileAgent(), FakeMac.agent({})], ['p-hostile']));
		const harness = await AppHarness.start(mac);
		const screens = ['needs_you', 'panes', 'macros', 'launchers'];
		for (const screen of screens) {
			await harness.tap(`button[data-screen="${screen}"]`);
			expect(problemsOf(harness.root), screen).toEqual([]);
		}
		await harness.tap('button[data-screen="panes"]');
		await harness.openPane('p-1');
		expect(problemsOf(harness.root)).toEqual([]);
	});
});
