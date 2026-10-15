import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { FakeMac } from './fake_mac';
import { Fixtures } from './fixtures';

const __dirname = import.meta.dirname;

const identityText = Fs.readFileSync(Path.join(__dirname, '../../../../data/identity.json'), 'utf8');
const identity = JSON.parse(identityText) as {
	title: string;
	motto: { en: string };
	description: { en: string };
};

describe('Welcome page', () => {
	it('is the first page when the address of the page names no screen', async () => {
		await AppHarness.start(Fixtures.mac(), true, '');
		expect(document.querySelector('.welcome')).not.toBeNull();
		expect(window.location.hash).toBe('#/welcome');
	});

	it('shows the baby goat, and the name, the motto, and the description from the identity file', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), true, '');
		expect(document.querySelector('.welcome-name')?.textContent).toBe(identity.title);
		expect(document.querySelector('.welcome-motto')?.textContent).toBe(identity.motto.en);
		const lines = [...document.querySelectorAll('.welcome-description .welcome-line')];
		const lineTexts = lines.map((line) => line.textContent);
		expect(lineTexts).toEqual([
			'Keep your agents working.',
			'Know which one needs you.',
		]);
		expect(lineTexts.join(' ')).toBe(identity.description.en);
		const image = document.querySelector<HTMLImageElement>('.welcome-image');
		expect(image?.getAttribute('src')).toMatch(/\.webp$/);
		expect(image?.getAttribute('alt')).toContain('baby goat');
		expect(harness.text()).toContain('Go to the app');
	});

	it('has no bottom bar and no header', async () => {
		await AppHarness.start(Fixtures.mac(), true, '');
		expect(document.querySelector('.bottom-bar')).toBeNull();
		expect(document.querySelector('header')).toBeNull();
	});

	it('opens the dashboard when the developer taps "Go to the app"', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), true, '');
		await harness.tap('.welcome-button');
		expect(document.querySelector('header h1')?.textContent).toBe('Dashboard');
		expect(document.querySelector('.bottom-bar')).not.toBeNull();
		expect(window.location.hash).toBe('#/dashboard');
	});

	it('shows before the pairing, and before the Mac answers', async () => {
		const unpaired = await AppHarness.start(Fixtures.mac(), false, '');
		expect(document.querySelector('.welcome')).not.toBeNull();
		expect(unpaired.text()).not.toContain('Pairing needed');
		const mac = Fixtures.mac();
		mac.isDown = true;
		await AppHarness.start(mac, true, '');
		expect(document.querySelector('.welcome')).not.toBeNull();
	});

	it('leads to the message "Pairing needed" when an unpaired phone taps "Go to the app"', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), false, '');
		await harness.tap('.welcome-button');
		expect(harness.text()).toContain('Pairing needed');
	});

	it('stays on the welcome page across the refreshes', async () => {
		const mac = new FakeMac(FakeMac.snapshotOf([Fixtures.working()], []));
		const harness = await AppHarness.start(mac, true, '');
		await harness.settle(9000);
		expect(document.querySelector('.welcome')).not.toBeNull();
	});
});
