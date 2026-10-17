import { CalendarDays } from "./calendar_days";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CalendarSlots — cuts a time range of whole days into slots of the same length, in the time zone of the computer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One slot: a day, or a part of a day. Every time is in milliseconds since 1 January 1970. */
export type CalendarSlot = {
	/** The start of the slot. */
	startedAt: number;
	/** The end of the slot, not included: the start of the next slot, or the midnight after the last slot of a day. */
	endedAt: number;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Constants
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The length of a slot that is a whole day, in hours. */
export const SLOT_HOURS_OF_A_DAY = 24;

/** The number of milliseconds in one hour. */
const HOUR_MILLISECONDS = 60 * 60 * 1000;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CalendarSlots
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The slots of a time range that ends today. It has no clock: the caller gives the current time. The first slot of a day
 * starts at midnight, and each slot lasts the same number of hours, counted from the start of the day, so a slot never
 * crosses midnight. The data layer cuts its hours in the same way (docs/statistics/token_usage_and_cost.md), so every row that it gives
 * is inside one slot. A day of 23 or 25 hours is cut by its real length: with slots of 6 hours, the last slot of a day of
 * 23 hours lasts 5 hours, and a day of 25 hours has a fifth slot of 1 hour.
 */
export class CalendarSlots {
	/**
	 * Gives the slots of a time range.
	 *
	 * @param now - The current time, in milliseconds since 1 January 1970.
	 * @param dayCount - The number of days of the time range, today included.
	 * @param slotHours - The length of a slot in hours. A length of 24 hours or more gives one slot for each day.
	 * @returns The slots, the oldest first. The last slot ends at the end of today.
	 */
	static build(now: number, dayCount: number, slotHours: number): CalendarSlot[] {
		const slots: CalendarSlot[] = [];
		for (const day of CalendarDays.build(now, dayCount)) {
			if (slotHours >= SLOT_HOURS_OF_A_DAY) {
				slots.push({ startedAt: day.startedAt, endedAt: day.endedAt });
				continue;
			}
			const slotMilliseconds = slotHours * HOUR_MILLISECONDS;
			for (let startedAt = day.startedAt; startedAt < day.endedAt; startedAt += slotMilliseconds) {
				slots.push({ startedAt, endedAt: Math.min(startedAt + slotMilliseconds, day.endedAt) });
			}
		}
		return slots;
	}

	/**
	 * Finds the slot that holds a time.
	 *
	 * @param slots - The slots of the time range.
	 * @param timeText - A time, an ISO 8601 text.
	 * @returns The index of the slot, or `-1` when the time is outside the slots or is not a time.
	 */
	static findIndex(slots: CalendarSlot[], timeText: string): number {
		return CalendarDays.findIndex(slots, timeText);
	}
}
