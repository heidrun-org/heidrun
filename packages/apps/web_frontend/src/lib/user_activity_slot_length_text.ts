import { t } from "../i18n/index";
import { USER_ACTIVITY_SLOT_LENGTHS, type UserActivitySlotLengthId } from "./user_activity_slots";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivitySlotLengthText — writes the length of a slot in words, in the language of the application
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export class UserActivitySlotLengthText {
	/**
	 * Writes the length of a slot, for example "5 minutes", "1 hour", or "1 day".
	 *
	 * @param slotLengthId - The slot length.
	 * @returns The length of the slot, with its unit, in the language of the application.
	 */
	static of(slotLengthId: UserActivitySlotLengthId): string {
		const { amount, unit } = USER_ACTIVITY_SLOT_LENGTHS[slotLengthId];
		if (unit === "minute") {
			return t("statisticsModal.slotLengthMinutes", { count: amount });
		}
		if (unit === "hour") {
			return t("statisticsModal.slotLengthHours", { count: amount });
		}
		return t("statisticsModal.slotLengthDays", { count: amount });
	}
}
