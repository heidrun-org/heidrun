import { describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { FakeMac } from './fake_mac';
import { Fixtures } from './fixtures';

describe('Needs you screen', () => {
	it('lists the blocked coding agent first, then the one with a question, then the finished one', async () => {
		await AppHarness.start(Fixtures.mac());
		const cards = [...document.querySelectorAll<HTMLElement>('main .card')];
		const paneIds = cards.map((card) => card.dataset.paneId);
		expect(paneIds).toEqual(['p-blocked', 'p-asking', 'p-finished']);
	});

	it('shows the status, the workspace, the tab, and the age of each coding agent', async () => {
		const harness = await AppHarness.start(Fixtures.mac());
		expect(harness.text()).toContain('Blocked');
		expect(harness.text()).toContain('Question');
		expect(harness.text()).toContain('Finished');
		expect(harness.text()).toContain('heidrun · review-12');
		expect(harness.text()).toContain('Claude Code · 2 min ago');
	});

	it('shows the question, the command, and one button for each choice of the blocked coding agent', async () => {
		const harness = await AppHarness.start(Fixtures.mac());
		expect(harness.text()).toContain('Run this command?');
		expect(harness.text()).toContain('rm -rf build');
		expect(harness.text()).toContain('Which file should I change?');
		const labels = [...document.querySelectorAll('button[data-action="answer"]')].map((button) =>
			(button.textContent ?? '').replace(/\s+/g, ' ').trim(),
		);
		expect(labels).toEqual(['1. Yes', '2. Yes, and do not ask again', '3. No']);
	});

	it('shows the usage limits', async () => {
		const harness = await AppHarness.start(Fixtures.mac());
		expect(harness.text()).toContain('5-hour limit 42 %');
	});

	it('says that nothing waits when no coding agent needs the developer', async () => {
		const mac = new FakeMac(FakeMac.snapshotOf([Fixtures.working()], []));
		const harness = await AppHarness.start(mac);
		expect(harness.text()).toContain('Nothing waits for your decision.');
		expect(document.querySelectorAll('main .card')).toHaveLength(0);
	});

	it('sends the number of the choice to the blocked coding agent, and does not open the pane', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.tap('button[data-action="answer"][data-n="2"]');
		expect(mac.callsOf('answer').map((call) => call.params)).toEqual([
			{
				paneId: 'p-blocked',
				n: 2,
			},
		]);
		expect(mac.callsOf('read')).toHaveLength(0);
		expect(harness.toast()).toBe('Answer sent');
	});

	it('opens the pane of a coding agent when the developer taps its card', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		await harness.tap('article[data-pane-id="p-asking"] .name');
		expect(document.querySelector('.back')).not.toBeNull();
		expect(mac.callsOf('read').map((call) => call.params)).toEqual([
			{
				paneId: 'p-asking',
				lines: 80,
				ansi: true,
			},
		]);
	});

	it('asks for the state again every 4 seconds', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		expect(mac.callsOf('state')).toHaveLength(1);
		await harness.settle(4000);
		expect(mac.callsOf('state')).toHaveLength(2);
		await harness.settle(4000);
		expect(mac.callsOf('state')).toHaveLength(3);
	});
});

describe('Needs you screen without a connection', () => {
	it('asks for the pairing when the phone has no key, and calls nothing', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac, false);
		expect(harness.text()).toContain('Pairing needed');
		expect(mac.calls).toEqual([]);
	});

	it('asks for the pairing again, and forgets the key, when the Mac refuses the key', async () => {
		const mac = Fixtures.mac();
		mac.acceptedKey = 'b'.repeat(64);
		const harness = await AppHarness.start(mac);
		expect(harness.text()).toContain('Pairing needed');
		expect(window.localStorage.getItem('hd-token')).toBeNull();
	});

	it('says that the Mac does not answer, and comes back when the Mac answers again', async () => {
		const mac = Fixtures.mac();
		mac.isDown = true;
		const harness = await AppHarness.start(mac);
		expect(harness.text()).toContain('The Mac does not answer');
		mac.isDown = false;
		await harness.settle(4000);
		expect(harness.text()).toContain('Run this command?');
	});

	it('keeps the last list, and turns the connection dot red, when the Mac stops answering', async () => {
		const mac = Fixtures.mac();
		const harness = await AppHarness.start(mac);
		expect(document.querySelector('header .dot-ok')).not.toBeNull();
		mac.isDown = true;
		await harness.settle(4000);
		expect(harness.text()).toContain('Run this command?');
		const dot = document.querySelector('header .dot-blocked');
		expect(dot?.getAttribute('aria-label')).toBe('Not connected to the Mac');
	});
});
