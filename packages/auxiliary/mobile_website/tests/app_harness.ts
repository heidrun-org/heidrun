import { vi } from 'vitest';
import { MobileApp } from '../src/mobile_app';
import { FakeMac } from './fake_mac';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AppHarness — starts the page against a fake Mac, and taps on it
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * One page, started on an empty document, with fake timers.
 */
export class AppHarness {
	/** The page that started last. The next start stops it, so an old page does not listen to the window. */
	private static current: MobileApp | null = null;

	/** The element that holds the screen. */
	readonly root: HTMLElement;

	/** The element that holds the message and the confirmation sheet. */
	readonly overlay: HTMLElement;

	/** The page. */
	readonly app: MobileApp;

	private constructor(root: HTMLElement, overlay: HTMLElement, app: MobileApp) {
		this.root = root;
		this.overlay = overlay;
		this.app = app;
	}

	/**
	 * Starts a page that is paired with the fake Mac.
	 * @param mac The fake Mac.
	 * @param isPaired False to start a phone that has no pairing key.
	 * @param hash The part of the address after the path when the page opens, for example `#/panes`.
	 * @returns The page, after its first refresh.
	 */
	static async start(mac: FakeMac, isPaired = true, hash = ''): Promise<AppHarness> {
		AppHarness.current?.stop();
		vi.useFakeTimers();
		window.history.replaceState(null, '', `/${hash}`);
		document.body.innerHTML = '<div id="app"></div><div id="overlay"></div>';
		window.localStorage.clear();
		if (isPaired) {
			window.localStorage.setItem('hd-token', FakeMac.key);
		}
		mac.install();
		const root = document.getElementById('app') as HTMLElement;
		const overlay = document.getElementById('overlay') as HTMLElement;
		const harness = new AppHarness(root, overlay, new MobileApp(root, overlay));
		AppHarness.current = harness.app;
		await harness.app.start();
		return harness;
	}

	/**
	 * Taps on an element, then lets the calls and the timers of 1 millisecond run.
	 * @param selector The CSS selector of the element.
	 */
	async tap(selector: string): Promise<void> {
		const element = document.querySelector<HTMLElement>(selector);
		if (element === null) {
			throw new Error(`no element for ${selector}`);
		}
		element.click();
		await this.settle();
	}

	/**
	 * Opens the screen Panes, then taps on the row of one coding agent, which opens its pane. The screen Needs you
	 * lists only the coding agents that need the developer, so it cannot open every pane.
	 * @param paneId The identifier of the pane.
	 */
	async openPane(paneId: string): Promise<void> {
		await this.tap('button[data-screen="panes"]');
		await this.tap(`[data-action="open-pane"][data-pane-id="${paneId}"]`);
	}

	/**
	 * Presses a key in the field where the developer types a prompt, then lets the calls and the timers run.
	 * @param key The name of the key, for example `Enter`.
	 * @param modifiers The modifier keys that are down, and the other fields of the keyboard event.
	 * @returns The keyboard event, so a test can read `defaultPrevented`.
	 */
	async press(key: string, modifiers: KeyboardEventInit): Promise<KeyboardEvent> {
		const event = new KeyboardEvent('keydown', {
			key,
			bubbles: true,
			cancelable: true,
			...modifiers,
		});
		this.field().dispatchEvent(event);
		await this.settle();
		return event;
	}

	/**
	 * Gives the field where the developer types a prompt.
	 * @returns The field of the screen of one pane.
	 */
	field(): HTMLTextAreaElement {
		const field = document.getElementById('prompt-field');
		if (field instanceof HTMLTextAreaElement === false) {
			throw new Error('the screen has no field for a prompt');
		}
		return field;
	}

	/**
	 * Gives the text of the message at the bottom of the screen.
	 * @returns The text of the message, or null when no message is shown.
	 */
	toast(): string | null {
		return this.overlay.querySelector('.toast')?.textContent ?? null;
	}

	/**
	 * Lets the pending calls and the timers of a few milliseconds run.
	 * @param milliseconds The time to let pass.
	 */
	async settle(milliseconds = 5): Promise<void> {
		await vi.advanceTimersByTimeAsync(milliseconds);
	}

	/**
	 * Gives the text of the screen.
	 * @returns The visible text of the root element.
	 */
	text(): string {
		return this.root.textContent ?? '';
	}
}
