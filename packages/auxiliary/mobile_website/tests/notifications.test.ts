import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';

/** The `Notification` of the browser: the permission, and the question to the developer. */
class FakeNotification {
	static permission: NotificationPermission = 'default';
	static answer: NotificationPermission = 'granted';
	static requestPermission = vi.fn(async () => {
		FakeNotification.permission = FakeNotification.answer;
		return FakeNotification.permission;
	});
}

const showNotification = vi.fn(async (..._parameters: unknown[]) => undefined);

/**
 * Gives the browser a service worker that registers, or that fails, and a `Notification`.
 * @param register What `navigator.serviceWorker.register` does.
 */
const installBrowser = (register: () => Promise<unknown>): void => {
	Object.defineProperty(window, 'isSecureContext', {
		value: true,
		configurable: true,
	});
	Object.defineProperty(navigator, 'serviceWorker', {
		value: {
			register,
		},
		configurable: true,
	});
	vi.stubGlobal('Notification', FakeNotification);
};

afterEach(() => {
	Reflect.deleteProperty(navigator, 'serviceWorker');
	vi.unstubAllGlobals();
	FakeNotification.permission = 'default';
	FakeNotification.answer = 'granted';
	FakeNotification.requestPermission.mockClear();
	showNotification.mockClear();
});

const rowOf = (name: string): string | null => {
	const rows = [...document.querySelectorAll('.notification-row')];
	const row = rows.find((candidate) => candidate.querySelector('span')?.textContent === name);
	return row?.querySelectorAll('span')[1]?.textContent ?? null;
};

describe('Notifications section of the Dashboard', () => {
	it('says that the browser cannot show notifications, and offers no button', async () => {
		const harness = await AppHarness.start(Fixtures.computer(), true, '#/dashboard');
		expect(harness.text()).toContain('Notifications');
		expect(rowOf('Browser support')).toBe('no');
		expect(harness.text()).toContain('Chrome on Android needs an address that starts with https.');
		expect(document.querySelector('[data-action^="notifications-"]')).toBeNull();
	});

	it('registers the service worker at /sw.js, and shows the button Enable notifications', async () => {
		const register = vi.fn(async () => ({ showNotification }));
		installBrowser(register);
		await AppHarness.start(Fixtures.computer(), true, '#/dashboard');
		expect(register).toHaveBeenCalledWith('/sw.js');
		expect(rowOf('Address with https')).toBe('yes');
		expect(rowOf('Browser support')).toBe('yes');
		expect(rowOf('Service worker')).toBe('registered');
		expect(rowOf('Permission')).toBe('default');
		expect(document.querySelector('[data-action="notifications-enable"]')).not.toBeNull();
	});

	it('shows the error of a service worker that fails to register, as it is', async () => {
		installBrowser(async () => {
			throw new TypeError('Failed to register a ServiceWorker: bad MIME type');
		});
		const harness = await AppHarness.start(Fixtures.computer(), true, '#/dashboard');
		expect(rowOf('Service worker')).toBe('failed');
		expect(harness.text()).toContain('TypeError: Failed to register a ServiceWorker: bad MIME type');
	});

	it('asks the browser for the permission at a tap, then offers the test notification', async () => {
		installBrowser(async () => ({ showNotification }));
		const harness = await AppHarness.start(Fixtures.computer(), true, '#/dashboard');
		await harness.tap('[data-action="notifications-enable"]');
		expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
		expect(rowOf('Permission')).toBe('granted');
		expect(document.querySelector('[data-action="notifications-enable"]')).toBeNull();
		expect(document.querySelector('[data-action="notifications-test"]')).not.toBeNull();
	});

	it('explains how to allow the notifications again when the developer refused', async () => {
		installBrowser(async () => ({ showNotification }));
		FakeNotification.answer = 'denied';
		const harness = await AppHarness.start(Fixtures.computer(), true, '#/dashboard');
		await harness.tap('[data-action="notifications-enable"]');
		expect(rowOf('Permission')).toBe('denied');
		expect(harness.text()).toContain('allow them in the settings of the browser');
		expect(document.querySelector('[data-action^="notifications-"]')).toBeNull();
	});

	it('sends a test notification through the service worker, with the screen that a tap opens', async () => {
		installBrowser(async () => ({ showNotification }));
		FakeNotification.permission = 'granted';
		const harness = await AppHarness.start(Fixtures.computer(), true, '#/dashboard');
		await harness.tap('[data-action="notifications-test"]');
		expect(showNotification).toHaveBeenCalledWith('Heidrun', {
			body: 'Test notification: a coding agent needs you.',
			tag: 'heidrun-test',
			data: {
				screen: '/needs-you',
			},
		});
		expect(harness.toast()).toBe('Test notification sent');
	});

	it('shows the error of a test notification that fails', async () => {
		installBrowser(async () => ({
			showNotification: async () => {
				throw new Error('no permission');
			},
		}));
		FakeNotification.permission = 'granted';
		const harness = await AppHarness.start(Fixtures.computer(), true, '#/dashboard');
		await harness.tap('[data-action="notifications-test"]');
		expect(harness.toast()).toBe('The notification failed: Error: no permission');
	});
});

describe('The file of the service worker', () => {
	const source = Fs.readFileSync(Path.join(__dirname, '../public/sw.js'), 'utf8');

	it('opens the screen of a notification when the developer taps it', () => {
		expect(source).toContain("addEventListener('notificationclick'");
		expect(source).toContain('openWindow');
	});

	it('has no cache and no fetch handler, so it never answers a call of the page in place of the computer', () => {
		expect(source).not.toContain("addEventListener('fetch'");
		expect(source).not.toContain('caches.');
	});
});
