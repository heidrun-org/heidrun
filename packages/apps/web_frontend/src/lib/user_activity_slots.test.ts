import { describe, expect, it } from "vitest";
import { UserActivitySlots, type UserActivityPeriodTimes } from "./user_activity_slots";

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
