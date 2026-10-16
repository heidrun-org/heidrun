import type { NotificationStatus } from './mobile_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PhoneNotifications — the service worker, the permission, and the notifications of the browser of the phone
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Gives access to the notifications of the browser. Chrome on Android shows a notification only through a service
 * worker, on an address that starts with `https`. A page in a plain tab can do it: it needs no installation.
 */
export class PhoneNotifications {
	/** The address of the file of the service worker. */
	static readonly workerAddress = '/sw.js';

	/** The service worker that is registered, or null before the registration ends, and when it fails. */
	private registration: ServiceWorkerRegistration | null = null;

	/** What the page knows now, for the screen. */
	private status: NotificationStatus = PhoneNotifications._initialStatus();

	/**
	 * Gives what the page knows now.
	 * @returns The status.
	 */
	getStatus(): NotificationStatus {
		return {
			...this.status,
			permission: PhoneNotifications._permission(),
		};
	}

	/**
	 * Registers the service worker. A failure does not throw: the status keeps the text of the error, and the
	 * screen shows it.
	 * @returns A promise that ends when the registration worked or failed.
	 */
	async register(): Promise<void> {
		if (this.status.isSupported === false) {
			return;
		}
		try {
			this.registration = await navigator.serviceWorker.register(PhoneNotifications.workerAddress);
			this.status = {
				...this.status,
				worker: 'registered',
				error: null,
			};
		} catch (error) {
			this.registration = null;
			this.status = {
				...this.status,
				worker: 'failed',
				error: PhoneNotifications._errorText(error),
			};
		}
	}

	/**
	 * Asks the developer to allow the notifications. The browser shows its own question, and only a tap of the
	 * developer can start it: call this method in the handler of a tap, before any other waiting.
	 * @returns The answer of the developer: `granted`, `denied`, or `default` when the developer closed the question.
	 */
	async requestPermission(): Promise<NotificationPermission> {
		if (this.status.isSupported === false) {
			return 'denied';
		}
		return Notification.requestPermission();
	}

	/**
	 * Shows a notification that the page makes itself, to prove that the service worker and the permission work.
	 * @returns The text of the error, or null when the notification was sent to the system.
	 */
	async showTest(): Promise<string | null> {
		if (this.registration === null) {
			return 'The service worker is not registered';
		}
		try {
			await this.registration.showNotification('Heidrun', {
				body: 'Test notification: a coding agent needs you.',
				tag: 'heidrun-test',
				data: {
					screen: '/needs-you',
				},
			});
			return null;
		} catch (error) {
			return PhoneNotifications._errorText(error);
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Private methods
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	private static _initialStatus(): NotificationStatus {
		const isSupported = 'serviceWorker' in navigator && 'Notification' in window;
		return {
			isSecure: window.isSecureContext === true,
			isSupported,
			worker: 'not-registered',
			permission: PhoneNotifications._permission(),
			error: null,
		};
	}

	private static _permission(): NotificationPermission | 'unsupported' {
		return 'Notification' in window ? Notification.permission : 'unsupported';
	}

	private static _errorText(error: unknown): string {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}
