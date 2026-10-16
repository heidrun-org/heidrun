import type { NotificationStatus } from '../mobile_types';
import { NotificationsPanel } from './notifications_panel';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsSheet — the modal window of the settings of the phone, opened by the gear button of the Dashboard
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the settings of the phone over the Dashboard. For now it holds the notifications: the developer turns the push
 * on or off there, and sends a test notification. A tap outside the window, or on Close, closes it.
 */
export class SettingsSheet {
	/** The name of the CSS class of the sheet, which the page uses to find it in the overlay. */
	static readonly className = 'settings-sheet';

	/**
	 * Draws the sheet.
	 * @param notifications What the page knows about the notifications of the phone.
	 * @returns The HTML of the sheet.
	 */
	static render(notifications: NotificationStatus): string {
		const sheetHtmlContent = /* html */`
			<div class="sheet ${SettingsSheet.className}" data-action="settings-close">
				<div class="sheet-box">
					<h2>Settings</h2>
					${NotificationsPanel.render(notifications)}
					<div class="actions">
						<button class="button" data-action="settings-close">Close</button>
					</div>
				</div>
			</div>
		`;
		return sheetHtmlContent;
	}
}
