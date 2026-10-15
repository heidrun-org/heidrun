import { describe, expect, it } from "vitest";
import {
	USER_ACTIVITY_RANGES,
	USER_ACTIVITY_RANGE_IDS,
	USER_ACTIVITY_SLOT_LENGTHS,
	UserActivitySlots,
	type UserActivityPeriodTimes,
} from "./user_activity_slots";

/** The length of a slot of the last hour, in milliseconds: five minutes. */
const FIVE_MINUTES_MS = 5 * 60_000;

/** The time of 14 October 2026 at the given hour and minute, in UTC, in milliseconds. */
function at(hour: number, minute: number, second = 0): number {
	return Date.UTC(2026, 9, 14, hour, minute, second);
}

/** A record of an active period between two times in milliseconds. */
function period(startedAt: number, endedAt: number): UserActivityPeriodTimes {
	return { startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString() };
}

/** The user activity times of the twelve slots, in seconds, the oldest first. */
function seconds(activeTimesMs: { activeTimeMs: number }[]): number[] {
	return activeTimesMs.map((slot) => slot.activeTimeMs / 1000);
}

describe("UserActivitySlots.compute", () => {
	const now = at(14, 22, 30);

	it("gives twelve slots of five minutes that start on a multiple of five minutes, the last one holding the current time", () => {
		const slots = UserActivitySlots.compute([], null, now);
		expect(slots).toHaveLength(12);
		expect(slots[11].startedAt).toBe(at(14, 20));
		expect(slots[11].endedAt).toBe(at(14, 25));
		expect(slots[0].startedAt).toBe(at(13, 25));
		for (const slot of slots) {
			expect(slot.startedAt % FIVE_MINUTES_MS).toBe(0);
			expect(slot.endedAt - slot.startedAt).toBe(FIVE_MINUTES_MS);
		}
	});

	it("gives a height of 0 to every slot when there is no record and no running period", () => {
		expect(seconds(UserActivitySlots.compute([], null, now))).toEqual(new Array(12).fill(0));
	});

	it("puts one active period that is inside one slot in that slot only", () => {
		const slots = UserActivitySlots.compute([period(at(14, 6), at(14, 8, 30))], null, now);
		expect(slots[8].startedAt).toBe(at(14, 5));
		expect(seconds(slots)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 150, 0, 0, 0]);
	});

	it("cuts an active period at the limit between two slots, and each part counts in its own slot", () => {
		const slots = UserActivitySlots.compute([period(at(14, 8), at(14, 13))], null, now);
		expect(seconds(slots)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 120, 180, 0, 0]);
	});

	it("cuts an active period that starts before the first slot at the start of the first slot", () => {
		const slots = UserActivitySlots.compute([period(at(13, 20), at(13, 27))], null, now);
		expect(slots[0].startedAt).toBe(at(13, 25));
		expect(seconds(slots)).toEqual([120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
	});

	it("ignores an active period that ended before the first slot", () => {
		const slots = UserActivitySlots.compute([period(at(12, 0), at(12, 30))], null, now);
		expect(seconds(slots)).toEqual(new Array(12).fill(0));
	});

	it("counts the active period that runs now from its start up to the current time", () => {
		const slots = UserActivitySlots.compute([], at(14, 18, 30), now);
		expect(seconds(slots)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 90, 150]);
	});

	it("adds the periods of the same slot together, and never gives more than five minutes to a slot", () => {
		const records = [period(at(14, 0), at(14, 2)), period(at(14, 2), at(14, 3, 30)), period(at(14, 1), at(14, 5))];
		const slots = UserActivitySlots.compute(records, null, now);
		expect(slots[7].startedAt).toBe(at(14, 0));
		expect(slots[7].activeTimeMs).toBe(FIVE_MINUTES_MS);
	});

	it("never counts a period after the current time", () => {
		const slots = UserActivitySlots.compute([period(at(14, 21), at(14, 40))], null, now);
		expect(seconds(slots)[11]).toBe(90);
	});

	it("ignores a record whose time is not a date", () => {
		const slots = UserActivitySlots.compute([{ startedAt: "yesterday", endedAt: new Date(at(14, 10)).toISOString() }], null, now);
		expect(seconds(slots)).toEqual(new Array(12).fill(0));
	});

	it("reads a time that carries an offset of a time zone", () => {
		const record = { startedAt: "2026-10-14T16:06:00.000+02:00", endedAt: "2026-10-14T16:08:30.000+02:00" };
		expect(seconds(UserActivitySlots.compute([record], null, now))[8]).toBe(150);
	});
});

/** The time of 14 October 2026 plus `dayOffset` days, on the clock of the computer, in milliseconds. */
function local(dayOffset: number, hour: number, minute: number, second = 0): number {
	return new Date(2026, 9, 14 + dayOffset, hour, minute, second).getTime();
}

describe("UserActivitySlots.compute for the last day", () => {
	const now = local(0, 14, 22, 30);

	it("gives twenty-four slots of one hour that start at a full hour, the last one holding the current time", () => {
		const slots = UserActivitySlots.compute([], null, now, "day");
		expect(slots).toHaveLength(24);
		expect(slots[23].startedAt).toBe(local(0, 14, 0));
		expect(slots[23].endedAt).toBe(local(0, 15, 0));
		expect(slots[0].startedAt).toBe(local(-1, 15, 0));
		expect(UserActivitySlots.firstSlotStartedAt(now, "day")).toBe(local(-1, 15, 0));
	});

	it("cuts an active period at the limit between two hours, and each part counts in its own slot", () => {
		const slots = UserActivitySlots.compute([period(local(0, 12, 50), local(0, 13, 20))], null, now, "day");
		expect(slots[21].activeTimeMs).toBe(10 * 60_000);
		expect(slots[22].activeTimeMs).toBe(20 * 60_000);
		expect(seconds(slots).reduce((sum, value) => sum + value, 0)).toBe(30 * 60);
	});

	it("cuts an active period that starts before the first slot, and counts the period that runs now", () => {
		const records = [period(local(-1, 14, 30), local(-1, 15, 10))];
		const slots = UserActivitySlots.compute(records, local(0, 14, 10), now, "day");
		expect(slots[0].activeTimeMs).toBe(10 * 60_000);
		expect(slots[23].activeTimeMs).toBe(12.5 * 60_000);
	});
});

describe("UserActivitySlots.compute for the last week", () => {
	const now = local(0, 14, 22, 30);

	it("gives seven slots of one day that start at midnight, the last one holding the current time", () => {
		const slots = UserActivitySlots.compute([], null, now, "week");
		expect(slots).toHaveLength(7);
		expect(slots[6].startedAt).toBe(local(0, 0, 0));
		expect(slots[6].endedAt).toBe(local(1, 0, 0));
		expect(slots[0].startedAt).toBe(local(-6, 0, 0));
		expect(UserActivitySlots.firstSlotStartedAt(now, "week")).toBe(local(-6, 0, 0));
	});

	it("cuts an active period at midnight, and each part counts in its own day", () => {
		const slots = UserActivitySlots.compute([period(local(-1, 23, 50), local(0, 0, 20))], null, now, "week");
		expect(slots[5].activeTimeMs).toBe(10 * 60_000);
		expect(slots[6].activeTimeMs).toBe(20 * 60_000);
	});

	it("cuts an active period that starts before the first day at the start of the first day", () => {
		const slots = UserActivitySlots.compute([period(local(-7, 23, 0), local(-6, 1, 0))], null, now, "week");
		expect(slots[0].activeTimeMs).toBe(60 * 60_000);
		expect(seconds(slots).slice(1)).toEqual(new Array(6).fill(0));
	});

	it("adds the periods of the same day together", () => {
		const records = [period(local(-3, 9, 0), local(-3, 10, 0)), period(local(-3, 14, 0), local(-3, 14, 30))];
		expect(UserActivitySlots.compute(records, null, now, "week")[3].activeTimeMs).toBe(90 * 60_000);
	});
});

describe("UserActivitySlots.slotCount", () => {
	it("gives the number of slots of the length of the range divided by the slot length", () => {
		expect(UserActivitySlots.slotCount("hour")).toBe(12);
		expect(UserActivitySlots.slotCount("hour", "one_minute")).toBe(60);
		expect(UserActivitySlots.slotCount("hour", "ten_minutes")).toBe(6);
		expect(UserActivitySlots.slotCount("day")).toBe(24);
		expect(UserActivitySlots.slotCount("day", "fifteen_minutes")).toBe(96);
		expect(UserActivitySlots.slotCount("day", "thirty_minutes")).toBe(48);
		expect(UserActivitySlots.slotCount("week")).toBe(7);
		expect(UserActivitySlots.slotCount("week", "one_hour")).toBe(168);
		expect(UserActivitySlots.slotCount("week", "six_hours")).toBe(28);
	});

	it("gives a whole number of slots for every slot length that a range offers", () => {
		for (const rangeId of USER_ACTIVITY_RANGE_IDS) {
			const { slotLengthIds, defaultSlotLengthId } = USER_ACTIVITY_RANGES[rangeId];
			expect(slotLengthIds).toContain(defaultSlotLengthId);
			for (const slotLengthId of slotLengthIds) {
				const count = UserActivitySlots.slotCount(rangeId, slotLengthId);
				expect(Number.isInteger(count)).toBe(true);
				expect(UserActivitySlots.compute([], null, local(0, 14, 22, 30), rangeId, slotLengthId)).toHaveLength(count);
			}
		}
	});

	it("offers the slot lengths of the issue in each range", () => {
		expect(USER_ACTIVITY_RANGES.hour.slotLengthIds).toEqual(["one_minute", "five_minutes", "ten_minutes"]);
		expect(USER_ACTIVITY_RANGES.day.slotLengthIds).toEqual(["fifteen_minutes", "thirty_minutes", "one_hour"]);
		expect(USER_ACTIVITY_RANGES.week.slotLengthIds).toEqual(["one_hour", "six_hours", "one_day"]);
		expect(Object.keys(USER_ACTIVITY_SLOT_LENGTHS)).toHaveLength(8);
	});
});

describe("UserActivitySlots.compute with a chosen slot length", () => {
	const now = local(0, 14, 22, 30);

	it("gives sixty slots of one minute for the last hour, the last one holding the current time", () => {
		const slots = UserActivitySlots.compute([period(local(0, 14, 10, 20), local(0, 14, 11, 10))], null, now, "hour", "one_minute");
		expect(slots).toHaveLength(60);
		expect(slots[59].startedAt).toBe(local(0, 14, 22));
		expect(slots[0].startedAt).toBe(local(0, 13, 23));
		expect(slots[47].activeTimeMs).toBe(40_000);
		expect(slots[48].activeTimeMs).toBe(10_000);
	});

	it("gives six slots of ten minutes that start on a multiple of ten minutes", () => {
		const slots = UserActivitySlots.compute([], local(0, 14, 5), now, "hour", "ten_minutes");
		expect(slots).toHaveLength(6);
		expect(slots[5].startedAt).toBe(local(0, 14, 20));
		expect(slots[0].startedAt).toBe(local(0, 13, 30));
		expect(seconds(slots)).toEqual([0, 0, 0, 300, 600, 150]);
	});

	it("gives ninety-six slots of fifteen minutes for the last day, on a multiple of fifteen minutes", () => {
		const slots = UserActivitySlots.compute([period(local(0, 13, 55), local(0, 14, 20))], null, now, "day", "fifteen_minutes");
		expect(slots).toHaveLength(96);
		expect(slots[95].startedAt).toBe(local(0, 14, 15));
		expect(slots[0].startedAt).toBe(local(-1, 14, 30));
		expect(slots[93].activeTimeMs).toBe(5 * 60_000);
		expect(slots[94].activeTimeMs).toBe(15 * 60_000);
		expect(slots[95].activeTimeMs).toBe(5 * 60_000);
	});

	it("gives forty-eight slots of thirty minutes for the last day", () => {
		const slots = UserActivitySlots.compute([], null, now, "day", "thirty_minutes");
		expect(slots).toHaveLength(48);
		expect(slots[47].startedAt).toBe(local(0, 14, 0));
		expect(slots[47].endedAt).toBe(local(0, 14, 30));
		expect(slots[0].startedAt).toBe(local(-1, 14, 30));
	});

	it("gives one hundred sixty-eight slots of one hour for the last week", () => {
		const slots = UserActivitySlots.compute([period(local(-2, 9, 30), local(-2, 10, 15))], null, now, "week", "one_hour");
		expect(slots).toHaveLength(168);
		expect(slots[167].startedAt).toBe(local(0, 14, 0));
		expect(slots[0].startedAt).toBe(local(-7, 15, 0));
		const hours = slots.filter((slot) => slot.activeTimeMs > 0);
		expect(hours.map((slot) => slot.activeTimeMs)).toEqual([30 * 60_000, 15 * 60_000]);
	});

	it("gives twenty-eight slots of six hours for the last week, starting at midnight, six, twelve, and eighteen hours", () => {
		const slots = UserActivitySlots.compute([period(local(0, 5, 0), local(0, 7, 0))], null, now, "week", "six_hours");
		expect(slots).toHaveLength(28);
		expect(slots[27].startedAt).toBe(local(0, 12, 0));
		expect(slots[27].endedAt).toBe(local(0, 18, 0));
		expect(slots[26].startedAt).toBe(local(0, 6, 0));
		expect(slots[25].startedAt).toBe(local(0, 0, 0));
		expect(slots[0].startedAt).toBe(local(-7, 18, 0));
		expect(slots[25].activeTimeMs).toBe(60 * 60_000);
		expect(slots[26].activeTimeMs).toBe(60 * 60_000);
	});

	it("keeps the one-day slots of the last week when the slot length is chosen to be one day", () => {
		const slots = UserActivitySlots.compute([period(local(-3, 9, 0), local(-3, 10, 0))], null, now, "week", "one_day");
		expect(slots).toHaveLength(7);
		expect(slots[3].activeTimeMs).toBe(60 * 60_000);
	});

	it("gives the same total of user activity time for every slot length of a range", () => {
		const records = [period(local(0, 13, 40), local(0, 13, 52)), period(local(0, 14, 3), local(0, 14, 9, 30))];
		for (const slotLengthId of USER_ACTIVITY_RANGES.hour.slotLengthIds) {
			const slots = UserActivitySlots.compute(records, null, now, "hour", slotLengthId);
			expect(seconds(slots).reduce((sum, value) => sum + value, 0)).toBe(12 * 60 + 6 * 60 + 30);
		}
	});
});

describe("UserActivitySlots.earliestSlotStartedAt", () => {
	it("gives the start of the oldest slot of any range and any slot length", () => {
		const now = local(0, 14, 22, 30);
		expect(UserActivitySlots.earliestSlotStartedAt(now)).toBe(local(-7, 15, 0));
		for (const rangeId of USER_ACTIVITY_RANGE_IDS) {
			for (const slotLengthId of USER_ACTIVITY_RANGES[rangeId].slotLengthIds) {
				expect(UserActivitySlots.earliestSlotStartedAt(now)).toBeLessThanOrEqual(
					UserActivitySlots.firstSlotStartedAt(now, rangeId, slotLengthId),
				);
			}
		}
	});
});

describe("UserActivitySlots.labelStepInMinutes", () => {
	it("gives no more than thirteen labels, each on a whole number of slots, for every range and every slot length", () => {
		for (const rangeId of USER_ACTIVITY_RANGE_IDS) {
			const { lengthInMinutes, slotLengthIds } = USER_ACTIVITY_RANGES[rangeId];
			for (const slotLengthId of slotLengthIds) {
				const step = UserActivitySlots.labelStepInMinutes(rangeId, slotLengthId);
				const slotInMinutes = lengthInMinutes / UserActivitySlots.slotCount(rangeId, slotLengthId);
				expect(step % slotInMinutes).toBe(0);
				expect(lengthInMinutes / step).toBeLessThanOrEqual(13);
			}
		}
	});

	it("gives the steps that the histogram shows for the slot lengths of the issue", () => {
		expect(UserActivitySlots.labelStepInMinutes("hour", "one_minute")).toBe(5);
		expect(UserActivitySlots.labelStepInMinutes("hour")).toBe(5);
		expect(UserActivitySlots.labelStepInMinutes("hour", "ten_minutes")).toBe(10);
		expect(UserActivitySlots.labelStepInMinutes("day", "fifteen_minutes")).toBe(120);
		expect(UserActivitySlots.labelStepInMinutes("day")).toBe(120);
		expect(UserActivitySlots.labelStepInMinutes("week", "one_hour")).toBe(1440);
		expect(UserActivitySlots.labelStepInMinutes("week", "six_hours")).toBe(1440);
		expect(UserActivitySlots.labelStepInMinutes("week")).toBe(1440);
	});
});
