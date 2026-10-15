import { describe, expect, it, vi } from 'vitest';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';

const screenTitle = (): string => document.querySelector('header h1')?.textContent ?? '';

describe('Navigation and address', () => {
	it('opens the welcome page, and puts it in the address, when the page opens with no address', async () => {
		await AppHarness.start(Fixtures.mac(), true, '');
		expect(document.querySelector('.welcome')).not.toBeNull();
		expect(window.location.hash).toBe('#/welcome');
	});

	it('opens the welcome page when the address is only the sign "#"', async () => {
		await AppHarness.start(Fixtures.mac(), true, '#');
		expect(document.querySelector('.welcome')).not.toBeNull();
		expect(window.location.hash).toBe('#/welcome');
	});

	it('puts the screen in the address when the developer taps the bottom bar', async () => {
		const harness = await AppHarness.start(Fixtures.mac());
		await harness.tap('button[data-screen="panes"]');
		expect(window.location.hash).toBe('#/panes');
		await harness.tap('button[data-screen="macros"]');
		expect(window.location.hash).toBe('#/macros');
		await harness.tap('button[data-screen="needs_you"]');
		expect(window.location.hash).toBe('#/needs-you');
		await harness.tap('button[data-screen="dashboard"]');
		expect(window.location.hash).toBe('#/dashboard');
	});

	it('puts the pane in the address, after the screen where the developer opened it', async () => {
		const harness = await AppHarness.start(Fixtures.mac());
		await harness.openPane('p-working');
		expect(window.location.hash).toBe('#/panes/p-working');
		await harness.tap('button[data-action="back"]');
		expect(window.location.hash).toBe('#/panes');
	});

	it('opens a pane from the screen Needs you, and keeps that screen in the address', async () => {
		const harness = await AppHarness.start(Fixtures.mac());
		await harness.tap('[data-action="open-pane"][data-pane-id="p-asking"]');
		expect(window.location.hash).toBe('#/needs-you/p-asking');
		await harness.tap('button[data-action="back"]');
		expect(window.location.hash).toBe('#/needs-you');
	});

	it('opens the screen of the address when the page loads again', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), true, '#/panes/p-working');
		expect(screenTitle()).toBe('heidrun · fix-35');
		expect(document.querySelector('.output')).not.toBeNull();
		expect(window.location.hash).toBe('#/panes/p-working');
		expect(harness.text()).toContain('Codex');
		await harness.tap('button[data-action="back"]');
		expect(screenTitle()).toBe('Panes');
	});

	it('opens the screen Panes when the address names it', async () => {
		await AppHarness.start(Fixtures.mac(), true, '#/panes');
		expect(screenTitle()).toBe('Panes');
		const panesButton = document.querySelector('button[data-screen="panes"]');
		expect(panesButton?.getAttribute('aria-current')).toBe('page');
	});

	it('opens the welcome page when the address is wrong', async () => {
		await AppHarness.start(Fixtures.mac(), true, '#/nowhere/p-1');
		expect(document.querySelector('.welcome')).not.toBeNull();
		expect(window.location.hash).toBe('#/welcome');
	});

	it('says that the coding agent does not exist anymore when the address names a missing pane', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), true, '#/panes/p-gone');
		expect(harness.text()).toContain('This coding agent does not exist anymore.');
	});

	it('asks for the pairing and then opens the screen of the address once paired', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), false, '#/panes/p-working');
		expect(harness.text()).toContain('Pairing needed');
		expect(window.location.hash).toBe('#/panes/p-working');
	});

	it('goes back to the earlier screen with the button Back of the browser, and forward again', async () => {
		const harness = await AppHarness.start(Fixtures.mac(), true, '');
		await harness.tap('.welcome-button');
		await harness.openPane('p-working');
		expect(screenTitle()).toBe('heidrun · fix-35');
		window.history.back();
		await vi.waitFor(() => expect(window.location.hash).toBe('#/panes'));
		await harness.settle();
		expect(screenTitle()).toBe('Panes');
		window.history.back();
		await vi.waitFor(() => expect(window.location.hash).toBe('#/dashboard'));
		await harness.settle();
		expect(screenTitle()).toBe('Dashboard');
		window.history.back();
		await vi.waitFor(() => expect(window.location.hash).toBe('#/welcome'));
		await harness.settle();
		expect(document.querySelector('.welcome')).not.toBeNull();
		window.history.forward();
		await vi.waitFor(() => expect(window.location.hash).toBe('#/dashboard'));
		await harness.settle();
		expect(screenTitle()).toBe('Dashboard');
	});

	it('keeps the pairing key out of the address after a scan, and opens the welcome page', async () => {
		const mac = Fixtures.mac();
		mac.acceptedKey = 'b'.repeat(64);
		const harness = await AppHarness.start(mac, false, `#t=${'b'.repeat(64)}`);
		expect(window.location.hash).toBe('#/welcome');
		expect(document.querySelector('.welcome')).not.toBeNull();
		expect(window.location.href).not.toContain('bbbb');
		expect(window.localStorage.getItem('hd-token')).toBe('b'.repeat(64));
		expect(harness.text()).not.toContain('Pairing needed');
	});
});
