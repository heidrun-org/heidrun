import { locale, t } from "../i18n/index";
import { SLOT_HOURS_OF_A_DAY, type CalendarSlot } from "./calendar_slots";
import { DayText } from "./day_text";
import { timeOptions } from "./format";
import { UserActivitySlots } from "./user_activity_slots";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SlotText — writes the slots of a bar chart for the axis and for the chart information card
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The number of minutes in one hour. */
const MINUTES_PER_HOUR = 60;

/** The number of minutes in one day. */
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** The text of a slot, in the language in use and in the time format of the settings. */
export class SlotText {
	/**
	 * Gives the label under each bar. A bar has a label when `UserActivitySlots.hasLabel` says so, so the axis has no more than
	 * thirteen labels. A label that sits on a midnight is the day, as `DayText.axis` writes it, and any other label is the
	 * time of the clock.
	 *
	 * @param slots - The slots of the time range, the oldest first.
	 * @param dayCount - The number of days of the time range.
	 * @param slotHours - The length of a slot in hours.
	 * @returns The label of each slot, or `null` for a slot that has none.
	 */
	static labels(slots: CalendarSlot[], dayCount: number, slotHours: number): Array<string | null> {
		const step = UserActivitySlots.labelStepFor(dayCount * MINUTES_PER_DAY, Math.min(slotHours, SLOT_HOURS_OF_A_DAY) * MINUTES_PER_HOUR);
		const lastSlotStartedAt = slots[slots.length - 1]?.startedAt ?? 0;
		return slots.map((slot) => {
			if (UserActivitySlots.hasLabel(slot.startedAt, lastSlotStartedAt, step) === false) {
				return null;
			}
			return SlotText._isMidnight(slot.startedAt) ? DayText.axis(slot.startedAt, dayCount) : SlotText.clock(slot.startedAt);
		});
	}

	/**
	 * Writes a slot for the title of the chart information card of a bar. A slot of one day gives its day in the long form. Any
	 * other slot gives its day, its start, and its end.
	 *
	 * @param slot - The slot.
	 * @param slotHours - The length of a slot in hours.
	 * @returns The text, for example "Monday, October 12" or "Monday, October 12, 06:00 to 12:00".
	 */
	static cardTitle(slot: CalendarSlot, slotHours: number): string {
		if (slotHours >= SLOT_HOURS_OF_A_DAY) {
			return DayText.cardTitle(slot.startedAt);
		}
		return t("statisticsModal.slotRangeTitle", {
			start: `${DayText.cardTitle(slot.startedAt)}, ${SlotText.clock(slot.startedAt)}`,
			end: SlotText.clock(slot.endedAt),
		});
	}

	/**
	 * Writes the length of a slot in words.
	 *
	 * @param slotHours - The length of a slot in hours.
	 * @returns The text, for example "1 hour", "6 hours", or "1 day".
	 */
	static length(slotHours: number): string {
		if (slotHours >= SLOT_HOURS_OF_A_DAY) {
			return t("statisticsModal.slotLengthDays", { count: slotHours / SLOT_HOURS_OF_A_DAY });
		}
		return t("statisticsModal.slotLengthHours", { count: slotHours });
	}

	/**
	 * Writes a time of the clock, in the language and in the time format of the settings.
	 *
	 * @param time - The time, in milliseconds since 1 January 1970.
	 * @returns The text, for example "06:00" or "6:00 AM".
	 */
	static clock(time: number): string {
		return new Date(time).toLocaleTimeString(locale.value, timeOptions());
	}

	/**
	 * Tells whether a time is the start of a day, in the time zone of the computer.
	 *
	 * @param time - The time, in milliseconds since 1 January 1970.
	 * @returns True when the clock shows 00:00 at this time.
	 */
	private static _isMidnight(time: number): boolean {
		const date = new Date(time);
		return date.getHours() === 0 && date.getMinutes() === 0;
	}
}
