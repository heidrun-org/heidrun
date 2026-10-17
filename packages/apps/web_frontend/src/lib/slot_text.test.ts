import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CalendarSlots } from "./calendar_slots";
import { SlotText } from "./slot_text";
import { settings } from "../stores/settings";

/** Wednesday 14 October 2026, 15:00 in the time zone of the computer. */
const NOW = new Date(2026, 9, 14, 15, 0, 0).getTime();

beforeEach(() => {
	settings.timeFormat = "24h";
});

afterEach(() => {
	settings.timeFormat = "auto";
});

/** The labels that a bar chart shows, with the place of each label. */
function shownLabels(labels: Array<string | null>): Array<[number, string]> {
	return labels.flatMap((label, index) => (label === null ? [] : [[index, label] as [number, string]]));
}

describe("SlotText.length", () => {
	it("writes the length of a slot with its unit, in the singular for one and in the plural for the other numbers", () => {
		expect(SlotText.length(1)).toBe("1 hour");
		expect(SlotText.length(6)).toBe("6 hours");
		expect(SlotText.length(24)).toBe("1 day");
	});
});

describe("SlotText.labels", () => {
	it("labels each day of the last 7 days with its weekday and its date, for slots of one day", () => {
		const labels = SlotText.labels(CalendarSlots.build(NOW, 7, 24), 7, 24);
		expect(labels).toHaveLength(7);
		expect(labels.every((label) => label !== null)).toBe(true);
		expect(labels[6]).toBe(new Date(2026, 9, 14).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" }));
	});

	it("labels every third midnight of the last 30 days, counted back from today, with the date only", () => {
		const labels = SlotText.labels(CalendarSlots.build(NOW, 30, 24), 30, 24);
		expect(shownLabels(labels)).toHaveLength(10);
		expect(labels[29]).toBe(new Date(2026, 9, 14).toLocaleDateString("en", { day: "numeric", month: "short" }));
		expect(labels[28]).toBeNull();
		expect(labels[26]).toBe(new Date(2026, 9, 11).toLocaleDateString("en", { day: "numeric", month: "short" }));
	});

	it("labels each midnight of the last 7 days for slots of 6 hours, and no other slot", () => {
		const labels = SlotText.labels(CalendarSlots.build(NOW, 7, 6), 7, 6);
		expect(labels).toHaveLength(28);
		expect(shownLabels(labels).map(([index]) => index)).toEqual([0, 4, 8, 12, 16, 20, 24]);
	});

	it("labels each midnight of the last 7 days for slots of 1 hour, so the axis has 7 labels", () => {
		const labels = SlotText.labels(CalendarSlots.build(NOW, 7, 1), 7, 1);
		expect(labels).toHaveLength(168);
		expect(shownLabels(labels).map(([index]) => index)).toEqual([0, 24, 48, 72, 96, 120, 144]);
	});

	it("labels every third midnight of the last 30 days for slots of 6 hours", () => {
		const labels = SlotText.labels(CalendarSlots.build(NOW, 30, 6), 30, 6);
		expect(labels).toHaveLength(120);
		expect(shownLabels(labels)).toHaveLength(10);
		expect(labels[116]).not.toBeNull();
		expect(labels[112]).toBeNull();
	});

	it("labels every 6 hours of the last 3 days for slots of 1 hour, the day on each midnight and the time of the clock on the others", () => {
		const labels = SlotText.labels(CalendarSlots.build(NOW, 3, 1), 3, 1);
		expect(labels).toHaveLength(72);
		expect(shownLabels(labels).map(([index]) => index)).toEqual([0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66]);
		const dayText = new Date(2026, 9, 12).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" });
		expect(labels[0]).toBe(dayText);
		expect(labels[6]).toBe(SlotText.clock(new Date(2026, 9, 12, 6).getTime()));
		expect(labels[24]).toBe(new Date(2026, 9, 13).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" }));
	});

	it("labels every third midnight of the last 14 days, whatever the slot length", () => {
		for (const slotHours of [1, 6, 24]) {
			const labels = SlotText.labels(CalendarSlots.build(NOW, 14, slotHours), 14, slotHours);
			expect(shownLabels(labels)).toHaveLength(5);
			const slotsOfADay = 24 / slotHours;
			expect(labels[labels.length - slotsOfADay]).not.toBeNull();
		}
	});

	it("never gives more than 13 labels", () => {
		for (const [dayCount, slotHours] of [[3, 1], [3, 6], [3, 24], [7, 1], [7, 6], [7, 24], [14, 1], [14, 6], [14, 24], [30, 1], [30, 6], [30, 24]]) {
			const labels = SlotText.labels(CalendarSlots.build(NOW, dayCount, slotHours), dayCount, slotHours);
			expect(shownLabels(labels).length).toBeLessThanOrEqual(13);
		}
	});
});

describe("SlotText.cardTitle", () => {
	it("gives the long day for a slot of one day", () => {
		const slot = CalendarSlots.build(NOW, 7, 24)[6];
		expect(SlotText.cardTitle(slot, 24)).toBe("Wednesday, October 14");
	});

	it("gives the day, the start, and the end of a slot of 6 hours or of 1 hour", () => {
		const sixHours = CalendarSlots.build(NOW, 7, 6)[26];
		expect(SlotText.cardTitle(sixHours, 6)).toBe("Wednesday, October 14, 12:00 to 18:00");
		const oneHour = CalendarSlots.build(NOW, 7, 1)[6 * 24 + 5];
		expect(SlotText.cardTitle(oneHour, 1)).toBe("Wednesday, October 14, 05:00 to 06:00");
	});

	it("writes the end of the last slot of a day as midnight", () => {
		const lastSlot = CalendarSlots.build(NOW, 7, 6)[27];
		expect(SlotText.cardTitle(lastSlot, 6)).toBe("Wednesday, October 14, 18:00 to 00:00");
	});
});
