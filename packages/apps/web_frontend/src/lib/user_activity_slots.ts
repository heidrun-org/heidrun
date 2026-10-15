import type { UserActivityRecord } from "./user_activity";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivitySlots — cuts the user activity time of the last hour, day, and week into slots
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The three time ranges of the histograms: the last hour, the last day, and the last week. */
export type UserActivityRangeId = "hour" | "day" | "week";

/** The length of one slot: five minutes, one hour, or one day. */
export type UserActivitySlotUnit = "five_minutes" | "hour" | "day";

/** The part of a user activity record that the calculation needs: the two times of the active period. */
export type UserActivityPeriodTimes = Pick<UserActivityRecord, "startedAt" | "endedAt">;

/** One slot of a histogram. Every time is in milliseconds since 1 January 1970. */
export type UserActivitySlot = {
	/** The start of the slot. It is a limit of the clock: a multiple of five minutes, a full hour, or midnight. */
	startedAt: number;
	/** The end of the slot: the start of the next slot. For the slot of the current time, the end is not reached yet. */
	endedAt: number;
	/** The user activity time inside the slot, in milliseconds. It is never more than the length of the slot. */
	activeTimeMs: number;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Constants
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The ranges, from the shortest to the longest. */
export const USER_ACTIVITY_RANGE_IDS: readonly UserActivityRangeId[] = ["hour", "day", "week"];

/**
 * The slots of each range. The last hour has twelve slots of five minutes. The last day has twenty-four slots of one
 * hour. The last week has seven slots of one day. In each range, the last slot is the slot of the current time.
 */
export const USER_ACTIVITY_RANGES: Record<UserActivityRangeId, { slotUnit: UserActivitySlotUnit; slotCount: number }> =
	{
		hour: { slotUnit: "five_minutes", slotCount: 12 },
		day: { slotUnit: "hour", slotCount: 24 },
		week: { slotUnit: "day", slotCount: 7 },
	};

/** The length of a slot of five minutes, in milliseconds. */
const FIVE_MINUTES_MS = 5 * 60_000;

/** The length of a slot of one hour, in milliseconds. */
const ONE_HOUR_MS = 60 * 60_000;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivitySlots
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The calculation of the histograms of the user activity time. It holds no clock and no timer: the caller gives the
 * current time, so that a test controls the time. The limits of the slots follow the clock of the computer: a slot of
 * one hour starts at a full hour, and a slot of one day starts at midnight, in the time zone of the computer.
 */
export class UserActivitySlots {
	/**
	 * The start of the first slot of a range: the slots before the slot of the current time. It is the start of the time
	 * range of the histogram.
	 *
	 * @param now - The current time, in milliseconds.
	 * @param rangeId - The range. The default is the last hour.
	 * @returns The start of the first slot, in milliseconds.
	 */
	static firstSlotStartedAt(now: number, rangeId: UserActivityRangeId = "hour"): number {
		const { slotUnit, slotCount } = USER_ACTIVITY_RANGES[rangeId];
		return UserActivitySlots._shift(slotUnit, UserActivitySlots._floor(slotUnit, now), -(slotCount - 1));
	}

	/**
	 * Cuts the user activity time into the slots of a range. The last slot is the slot of the current time. The user
	 * activity time of a slot is the total length of the parts of the active periods that are inside the slot. An
	 * active period that crosses the limit between two slots is cut at the limit. An active period that starts before
	 * the first slot is cut at the start of the first slot. A period never counts after the current time.
	 *
	 * @param records - The active periods that ended. A record with a time that is not a date is ignored.
	 * @param runningPeriodStartedAt - The start of the active period that runs now, or `null` when no period runs. This
	 * period has no record yet, so it counts from its start up to the current time.
	 * @param now - The current time, in milliseconds.
	 * @param rangeId - The range. The default is the last hour.
	 * @returns The slots, the oldest first.
	 */
	static compute(
		records: readonly UserActivityPeriodTimes[],
		runningPeriodStartedAt: number | null,
		now: number,
		rangeId: UserActivityRangeId = "hour",
	): UserActivitySlot[] {
		const { slotUnit, slotCount } = USER_ACTIVITY_RANGES[rangeId];
		const periods = UserActivitySlots._periodsOf(records, runningPeriodStartedAt, now);
		const currentSlotStartedAt = UserActivitySlots._floor(slotUnit, now);
		const slots: UserActivitySlot[] = [];
		for (let index = 0; index < slotCount; index += 1) {
			const stepsFromCurrentSlot = index - (slotCount - 1);
			const startedAt = UserActivitySlots._shift(slotUnit, currentSlotStartedAt, stepsFromCurrentSlot);
			const endedAt = UserActivitySlots._shift(slotUnit, currentSlotStartedAt, stepsFromCurrentSlot + 1);
			let activeTimeMs = 0;
			for (const period of periods) {
				const overlapStart = Math.max(period.startedAt, startedAt);
				const overlapEnd = Math.min(period.endedAt, endedAt);
				if (overlapEnd > overlapStart) {
					activeTimeMs += overlapEnd - overlapStart;
				}
			}
			slots.push({ startedAt, endedAt, activeTimeMs: Math.min(activeTimeMs, endedAt - startedAt) });
		}
		return slots;
	}

	/**
	 * Turns the records and the running period into periods in milliseconds, none of them after the current time.
	 *
	 * @param records - The active periods that ended.
	 * @param runningPeriodStartedAt - The start of the active period that runs now, or `null`.
	 * @param now - The current time, in milliseconds.
	 * @returns The periods, in milliseconds.
	 */
	private static _periodsOf(
		records: readonly UserActivityPeriodTimes[],
		runningPeriodStartedAt: number | null,
		now: number,
	): { startedAt: number; endedAt: number }[] {
		const periods: { startedAt: number; endedAt: number }[] = [];
		for (const record of records) {
			const startedAt = Date.parse(record.startedAt);
			const endedAt = Date.parse(record.endedAt);
			if (Number.isNaN(startedAt) === true || Number.isNaN(endedAt) === true) {
				continue;
			}
			periods.push({ startedAt, endedAt: Math.min(endedAt, now) });
		}
		if (runningPeriodStartedAt !== null) {
			periods.push({ startedAt: runningPeriodStartedAt, endedAt: now });
		}
		return periods;
	}

	/**
	 * Gives the start of the slot that holds a time, on the clock of the computer.
	 *
	 * @param slotUnit - The length of the slot.
	 * @param time - The time, in milliseconds.
	 * @returns The start of the slot, in milliseconds.
	 */
	private static _floor(slotUnit: UserActivitySlotUnit, time: number): number {
		const date = new Date(time);
		if (slotUnit === "five_minutes") {
			date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
		} else if (slotUnit === "hour") {
			date.setMinutes(0, 0, 0);
		} else {
			date.setHours(0, 0, 0, 0);
		}
		return date.getTime();
	}

	/**
	 * Moves the start of a slot by a number of slots. A day follows the calendar, so a day of 23 or 25 hours, at a change
	 * of the time of the clock, is still one slot.
	 *
	 * @param slotUnit - The length of the slot.
	 * @param slotStartedAt - The start of a slot, in milliseconds.
	 * @param steps - The number of slots to move: negative to go back in time.
	 * @returns The start of the slot that is `steps` slots away, in milliseconds.
	 */
	private static _shift(slotUnit: UserActivitySlotUnit, slotStartedAt: number, steps: number): number {
		if (slotUnit === "day") {
			const date = new Date(slotStartedAt);
			date.setDate(date.getDate() + steps);
			return date.getTime();
		}
		return slotStartedAt + steps * (slotUnit === "hour" ? ONE_HOUR_MS : FIVE_MINUTES_MS);
	}
}
