import type { UserActivityRecord } from "./user_activity";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivitySlots — cuts the user activity time of the last hour, day, and week into slots of a chosen length
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The three time ranges of the histograms: the last hour, the last day, and the last week. */
export type UserActivityRangeId = "hour" | "day" | "week";

/** The length of one slot: one of eight lengths, from one minute to one day. */
export type UserActivitySlotLengthId =
	| "one_minute"
	| "five_minutes"
	| "ten_minutes"
	| "fifteen_minutes"
	| "thirty_minutes"
	| "one_hour"
	| "six_hours"
	| "one_day";

/** The unit of the length of a slot. */
export type UserActivitySlotLengthUnit = "minute" | "hour" | "day";

/** The length of one slot, in a number of one unit. */
export type UserActivitySlotLength = {
	/** The number of units, for example 5 for "five minutes". */
	amount: number;
	/** The unit of the length. */
	unit: UserActivitySlotLengthUnit;
};

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

/** The length of a range, and the slot lengths that the developer can choose in it. */
export type UserActivityRangeChoices = {
	/** The length of the range, in minutes. */
	lengthInMinutes: number;
	/** The slot lengths of the range, from the shortest to the longest. */
	slotLengthIds: readonly UserActivitySlotLengthId[];
	/** The slot length that the range starts with, and that the range goes back to when its time range changes. */
	defaultSlotLengthId: UserActivitySlotLengthId;
};

/** The length of each slot length. */
export const USER_ACTIVITY_SLOT_LENGTHS: Record<UserActivitySlotLengthId, UserActivitySlotLength> = {
	one_minute: { amount: 1, unit: "minute" },
	five_minutes: { amount: 5, unit: "minute" },
	ten_minutes: { amount: 10, unit: "minute" },
	fifteen_minutes: { amount: 15, unit: "minute" },
	thirty_minutes: { amount: 30, unit: "minute" },
	one_hour: { amount: 1, unit: "hour" },
	six_hours: { amount: 6, unit: "hour" },
	one_day: { amount: 1, unit: "day" },
};

/**
 * The slot lengths that the developer can choose in each range, from the shortest to the longest, and the one that the
 * range starts with. A range has as many slots as its length holds slots of the chosen length, so the last hour with
 * slots of five minutes has twelve slots. In each range, the last slot is the slot of the current time.
 */
export const USER_ACTIVITY_RANGES: Record<UserActivityRangeId, UserActivityRangeChoices> = {
	hour: {
		lengthInMinutes: 60,
		slotLengthIds: ["one_minute", "five_minutes", "ten_minutes"],
		defaultSlotLengthId: "five_minutes",
	},
	day: {
		lengthInMinutes: 24 * 60,
		slotLengthIds: ["fifteen_minutes", "thirty_minutes", "one_hour"],
		defaultSlotLengthId: "one_hour",
	},
	week: {
		lengthInMinutes: 7 * 24 * 60,
		slotLengthIds: ["one_hour", "six_hours", "one_day"],
		defaultSlotLengthId: "one_day",
	},
};

/** The most labels that the horizontal axis of the histogram shows, so that the labels never touch each other. */
const MAX_LABEL_COUNT = 13;

/** The times between two labels that the horizontal axis can use, in minutes, from the shortest to the longest. */
const LABEL_STEPS_IN_MINUTES: readonly number[] = [1, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440];

/** The length of one minute, in milliseconds. */
const MINUTE_MS = 60_000;

/** The length of one hour, in milliseconds. */
const HOUR_MS = 60 * MINUTE_MS;

/** The number of minutes in one hour. */
const MINUTES_PER_HOUR = 60;

/** The number of minutes in one day. */
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

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
	 * The number of slots of a range, for a slot length.
	 *
	 * @param rangeId - The range.
	 * @param slotLengthId - The slot length. The default is the slot length that the range starts with.
	 * @returns The number of slots.
	 */
	static slotCount(rangeId: UserActivityRangeId, slotLengthId?: UserActivitySlotLengthId): number {
		const { lengthInMinutes, defaultSlotLengthId } = USER_ACTIVITY_RANGES[rangeId];
		const { amount, unit } = USER_ACTIVITY_SLOT_LENGTHS[slotLengthId ?? defaultSlotLengthId];
		const minutesPerUnit = { minute: 1, hour: MINUTES_PER_HOUR, day: MINUTES_PER_DAY }[unit];
		return Math.round(lengthInMinutes / (amount * minutesPerUnit));
	}

	/**
	 * The time between two labels of the horizontal axis: the shortest step that is a whole number of slots, and that
	 * gives no more than thirteen labels. A label sits on a slot that starts at a multiple of this time since midnight, on
	 * the clock of the computer. A step of one day, which is 1440 minutes, puts a label on each midnight.
	 *
	 * @param rangeId - The range.
	 * @param slotLengthId - The slot length. The default is the slot length that the range starts with.
	 * @returns The time between two labels, in minutes.
	 */
	static labelStepInMinutes(rangeId: UserActivityRangeId, slotLengthId?: UserActivitySlotLengthId): number {
		const { lengthInMinutes } = USER_ACTIVITY_RANGES[rangeId];
		const slotInMinutes = lengthInMinutes / UserActivitySlots.slotCount(rangeId, slotLengthId);
		for (const step of LABEL_STEPS_IN_MINUTES) {
			if (step % slotInMinutes === 0 && lengthInMinutes / step <= MAX_LABEL_COUNT) {
				return step;
			}
		}
		return 1440;
	}

	/**
	 * The start of the first slot of a range: the slots before the slot of the current time. It is the start of the time
	 * range of the histogram.
	 *
	 * @param now - The current time, in milliseconds.
	 * @param rangeId - The range. The default is the last hour.
	 * @param slotLengthId - The slot length. The default is the slot length that the range starts with.
	 * @returns The start of the first slot, in milliseconds.
	 */
	static firstSlotStartedAt(
		now: number,
		rangeId: UserActivityRangeId = "hour",
		slotLengthId?: UserActivitySlotLengthId,
	): number {
		const length = USER_ACTIVITY_SLOT_LENGTHS[slotLengthId ?? USER_ACTIVITY_RANGES[rangeId].defaultSlotLengthId];
		const slotCount = UserActivitySlots.slotCount(rangeId, slotLengthId);
		return UserActivitySlots._shift(length, UserActivitySlots._floor(length, now), -(slotCount - 1));
	}

	/**
	 * The start of the oldest slot that any choice of a range and of a slot length can show. The window reads the records
	 * from this time, so that no choice lacks a record.
	 *
	 * @param now - The current time, in milliseconds.
	 * @returns The start of the oldest slot, in milliseconds.
	 */
	static earliestSlotStartedAt(now: number): number {
		let earliest = now;
		for (const rangeId of USER_ACTIVITY_RANGE_IDS) {
			for (const slotLengthId of USER_ACTIVITY_RANGES[rangeId].slotLengthIds) {
				earliest = Math.min(earliest, UserActivitySlots.firstSlotStartedAt(now, rangeId, slotLengthId));
			}
		}
		return earliest;
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
	 * @param slotLengthId - The slot length. The default is the slot length that the range starts with.
	 * @returns The slots, the oldest first.
	 */
	static compute(
		records: readonly UserActivityPeriodTimes[],
		runningPeriodStartedAt: number | null,
		now: number,
		rangeId: UserActivityRangeId = "hour",
		slotLengthId?: UserActivitySlotLengthId,
	): UserActivitySlot[] {
		const length = USER_ACTIVITY_SLOT_LENGTHS[slotLengthId ?? USER_ACTIVITY_RANGES[rangeId].defaultSlotLengthId];
		const slotCount = UserActivitySlots.slotCount(rangeId, slotLengthId);
		const periods = UserActivitySlots._periodsOf(records, runningPeriodStartedAt, now);
		const currentSlotStartedAt = UserActivitySlots._floor(length, now);
		const slots: UserActivitySlot[] = [];
		for (let index = 0; index < slotCount; index += 1) {
			const stepsFromCurrentSlot = index - (slotCount - 1);
			const startedAt = UserActivitySlots._shift(length, currentSlotStartedAt, stepsFromCurrentSlot);
			const endedAt = UserActivitySlots._shift(length, currentSlotStartedAt, stepsFromCurrentSlot + 1);
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
	 * Gives the start of the slot that holds a time, on the clock of the computer. A slot of minutes starts on a multiple
	 * of its length inside the hour, a slot of hours starts on a multiple of its length inside the day, and a slot of one
	 * day starts at midnight.
	 *
	 * @param length - The length of the slot.
	 * @param time - The time, in milliseconds.
	 * @returns The start of the slot, in milliseconds.
	 */
	private static _floor(length: UserActivitySlotLength, time: number): number {
		const date = new Date(time);
		if (length.unit === "minute") {
			date.setMinutes(Math.floor(date.getMinutes() / length.amount) * length.amount, 0, 0);
		} else if (length.unit === "hour") {
			date.setHours(Math.floor(date.getHours() / length.amount) * length.amount, 0, 0, 0);
		} else {
			date.setHours(0, 0, 0, 0);
		}
		return date.getTime();
	}

	/**
	 * Moves the start of a slot by a number of slots. A slot of a few hours or of one day follows the calendar, so a day
	 * of 23 or 25 hours, at a change of the time of the clock, still has slots that start on the clock.
	 *
	 * @param length - The length of the slot.
	 * @param slotStartedAt - The start of a slot, in milliseconds.
	 * @param steps - The number of slots to move: negative to go back in time.
	 * @returns The start of the slot that is `steps` slots away, in milliseconds.
	 */
	private static _shift(length: UserActivitySlotLength, slotStartedAt: number, steps: number): number {
		if (length.unit === "day") {
			const date = new Date(slotStartedAt);
			date.setDate(date.getDate() + steps);
			return date.getTime();
		}
		if (length.unit === "hour" && length.amount > 1) {
			const date = new Date(slotStartedAt);
			date.setHours(date.getHours() + steps * length.amount);
			return date.getTime();
		}
		return slotStartedAt + steps * length.amount * (length.unit === "hour" ? HOUR_MS : MINUTE_MS);
	}
}
