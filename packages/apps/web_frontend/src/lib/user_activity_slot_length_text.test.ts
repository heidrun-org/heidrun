import { describe, expect, it } from "vitest";
import { UserActivitySlotLengthText } from "./user_activity_slot_length_text";
import { USER_ACTIVITY_SLOT_LENGTHS, type UserActivitySlotLengthId } from "./user_activity_slots";

describe("UserActivitySlotLengthText.of", () => {
	it("writes the length with its unit, in the singular for one and in the plural for the other numbers", () => {
		expect(UserActivitySlotLengthText.of("fifteen_minutes")).toBe("15 minutes");
		expect(UserActivitySlotLengthText.of("thirty_minutes")).toBe("30 minutes");
		expect(UserActivitySlotLengthText.of("one_hour")).toBe("1 hour");
		expect(UserActivitySlotLengthText.of("six_hours")).toBe("6 hours");
		expect(UserActivitySlotLengthText.of("one_day")).toBe("1 day");
	});

	it("gives a different text to each of the five slot lengths", () => {
		const slotLengthIds = Object.keys(USER_ACTIVITY_SLOT_LENGTHS) as UserActivitySlotLengthId[];
		expect(new Set(slotLengthIds.map((slotLengthId) => UserActivitySlotLengthText.of(slotLengthId))).size).toBe(5);
	});
});
