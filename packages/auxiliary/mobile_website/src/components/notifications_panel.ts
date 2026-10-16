import type { NotificationStatus } from '../mobile_types';
import { HtmlEscape } from '../html_escape';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NotificationsPanel — the state of the notifications of the phone, and the buttons that test them
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the section "Notifications" of the Dashboard. It shows the raw state of each part that a notification needs,
 * so a live test on a phone shows which part fails.
 */
export class NotificationsPanel {
	/**
	 * Draws the section.
	 * @param status What the page knows about the notifications.
	 * @returns The HTML of the section.
	 */
	static render(status: NotificationStatus): string {
		const rows = [
			['Address with https', status.isSecure ? 'yes' : 'no'],
			['Browser support', status.isSupported ? 'yes' : 'no'],
			['Service worker', NotificationsPanel._workerText(status)],
			['Permission', status.permission],
			['Push from the computer', status.push],
		];
		const rowsHtmlContent = rows
			.map(([name, value]) => /* html */`<div class="usage-row notification-row"><span>${name}</span><span>${HtmlEscape.escape(value)}</span></div>`)
			.join('');
		const errorHtmlContent =
			status.error === null ? '' : /* html */`<div class="detail">${HtmlEscape.escape(status.error)}</div>`;
		const panelHtmlContent = /* html */`
			<h2 class="eyebrow">Notifications</h2>
			<div class="usage">${rowsHtmlContent}</div>
			${errorHtmlContent}
			${NotificationsPanel._renderActions(status)}
		`;
		return panelHtmlContent;
	}

	private static _workerText(status: NotificationStatus): string {
		if (status.worker === 'failed') {
			return 'failed';
		}
		return status.worker === 'registered' ? 'registered' : 'not registered';
	}

	private static _renderButtons(status: NotificationStatus): string {
		if (status.permission !== 'granted') {
			const enableHtmlContent = /* html */`
				<button class="button button-primary" data-action="notifications-enable">Enable notifications</button>
			`;
			return enableHtmlContent;
		}
		const testHtmlContent = /* html */`
			<button class="button" data-action="notifications-test">Send a test notification</button>
		`;
		const pushHtmlContent =
			status.push === 'on'
				? /* html */`<button class="button" data-action="push-off">Turn off the push</button>`
				: /* html */`<button class="button button-primary" data-action="push-on">Turn on the push</button>`;
		return `${pushHtmlContent}${testHtmlContent}`;
	}

	private static _renderActions(status: NotificationStatus): string {
		if (status.isSupported === false) {
			const unsupportedHtmlContent = /* html */`
				<div class="sub">This browser, or this address, cannot show notifications. Chrome on Android needs an address that starts with https.</div>
			`;
			return unsupportedHtmlContent;
		}
		if (status.permission === 'denied') {
			const deniedHtmlContent = /* html */`
				<div class="sub">The notifications are blocked: allow them in the settings of the browser for this address.</div>
			`;
			return deniedHtmlContent;
		}
		const actionHtmlContent = NotificationsPanel._renderButtons(status);
		const actionsHtmlContent = /* html */`<div class="actions">${actionHtmlContent}</div>`;
		return actionsHtmlContent;
	}
}
