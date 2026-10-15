import { describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { FakeMac } from './fake_mac';
import { Fixtures } from './fixtures';

const countOf = (screen: string): { number: string; label: string } => {
	const card = document.querySelector(`.count-card[data-screen="${screen}"]`);
	return {
		number: card?.querySelector('.count-number')?.textContent ?? '',
		label: card?.querySelector('.count-label')?.textContent ?? '',
	};
};

describe('Home screen', () => {
	it('is the first page when the page opens with no address', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), true, '');
		expect(document.querySelector('header h1')?.textContent).toBe('Home');
		expect(harness.text()).toContain('Usage limits');
	});

	it('counts the coding agents that need the developer, and the ones that work', async () => {
		await AppHarness.start(Fixtures.mac(), true, '#/home');
		expect(countOf('needs_you')).toEqual({
			number: '3',
			label: 'Need you',
		});
		expect(countOf('panes')).toEqual({
			number: '1',
			label: 'Working',
		});
		expect(document.querySelector('.count-card-hot .count-label')?.textContent).toBe('Need you');
	});

	it('tells how many coding agents and workspaces there are', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), true, '#/home');
		expect(harness.text()).toContain('4 coding agents in 1 workspace');
	});

	it('says that nothing waits, and draws no hot count, when no coding agent needs the developer', async () => {
		const mac = new FakeMac(FakeMac.snapshotOf([Fixtures.working()], []));
		const harness = await AppHarness.start(mac, true, '#/home');
		expect(countOf('needs_you').number).toBe('0');
		expect(document.querySelector('.count-card-hot')).toBeNull();
		expect(harness.text()).toContain('Nothing waits for your decision.');
		expect(harness.text()).toContain('1 coding agent in 1 workspace');
	});

	it('works with no coding agent at all, and with no usage limit', async () => {
		const mac = new FakeMac(FakeMac.snapshotOf([], []));
		const harness = await AppHarness.start(mac, true, '#/home');
		expect(countOf('needs_you').number).toBe('0');
		expect(countOf('panes').number).toBe('0');
		expect(harness.text()).not.toContain('Usage limits');
		expect(harness.text()).toContain('0 coding agents in 1 workspace');
	});

	it('draws each usage limit with its percent and a bar', async () => {
		const mac = Fixtures.mac();
		mac.snapshot.quotas = [
			{
				name: '5-hour limit',
				percent: 42,
			},
			{
				name: 'Weekly limit',
				percent: 62,
			},
		];
		await AppHarness.start(mac, true, '#/home');
		const rows = [...document.querySelectorAll('.usage-row')];
		const names = rows.map((row) => row.querySelector('span')?.textContent);
		expect(names).toEqual(['5-hour limit', 'Weekly limit']);
		expect(rows.map((row) => row.querySelector('.usage-percent')?.textContent)).toEqual(['42 %', '62 %']);
		expect(rows.map((row) => row.querySelector('progress')?.getAttribute('value'))).toEqual(['42', '62']);
	});

	it('keeps the bar between 0 and 100 when the Mac sends a strange percent', async () => {
		const mac = Fixtures.mac();
		mac.snapshot.quotas = [
			{
				name: 'Over',
				percent: 250,
			},
			{
				name: 'Under',
				percent: -5,
			},
			{
				name: 'Wrong',
				percent: Number.NaN,
			},
		];
		await AppHarness.start(mac, true, '#/home');
		const values = [...document.querySelectorAll('progress')].map((bar) => bar.getAttribute('value'));
		expect(values).toEqual(['100', '0', '0']);
	});

	it('opens the screen Needs you when the developer taps the count Need you', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), true, '#/home');
		await harness.tap('.count-card[data-screen="needs_you"]');
		expect(document.querySelector('header h1')?.textContent).toBe('Needs you');
		expect(window.location.hash).toBe('#/needs-you');
	});

	it('opens the screen Panes when the developer taps the count Working', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), true, '#/home');
		await harness.tap('.count-card[data-screen="panes"]');
		expect(document.querySelector('header h1')?.textContent).toBe('Panes');
		expect(window.location.hash).toBe('#/panes');
	});

	it('shows the text of a usage limit as text, never as markup', async () => {
		const mac = Fixtures.mac();
		mac.snapshot.quotas = [
			{
				name: '<img src=x onerror=alert(1)>',
				percent: 10,
			},
		];
		const harness = await AppHarness.start(mac, true, '#/home');
		expect(document.querySelector('img')).toBeNull();
		expect(harness.text()).toContain('<img src=x onerror=alert(1)>');
	});
});
