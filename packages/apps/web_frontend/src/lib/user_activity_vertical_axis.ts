import { USER_ACTIVITY_SLOT_LENGTHS, type UserActivitySlotLengthId } from "./user_activity_slots";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivityVerticalAxis — chooses the unit, the top, and the lines of the vertical axis of the histogram
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The unit of the height of the bars: minutes for a slot of one hour or less, hours for a longer slot. */
export type UserActivityHeightUnit = "minutes" | "hours";

/** The vertical axis of the histogram for one slot length and one highest bar. */
export type UserActivityVerticalAxisChoice = {
	/** The unit of the height of the bars. */
	unit: UserActivityHeightUnit;
	/** The length of one unit of height, in milliseconds. */
	unitMs: number;
	/** The top of the axis, in the unit. It is never more than the length of the slot. */
	top: number;
	/** The space between two lines of the axis, in the unit. */
	step: number;
};

/** A top that the axis can have, with the space between two lines for this top. */
type AxisTop = {
	/** The top of the axis, in the unit. */
	top: number;
	/** The space between two lines of the axis, in the unit. */
	step: number;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Constants
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The tops of an axis in minutes, from the lowest to the highest. The highest top is the longest slot in minutes. */
const MINUTE_TOPS: readonly AxisTop[] = [
	{ top: 5, step: 1 },
	{ top: 10, step: 2 },
	{ top: 15, step: 5 },
	{ top: 30, step: 5 },
	{ top: 60, step: 10 },
];

/** The tops of an axis in hours, from the lowest to the highest. The highest top is the longest slot in hours. */
const HOUR_TOPS: readonly AxisTop[] = [
	{ top: 1, step: 0.5 },
	{ top: 2, step: 0.5 },
	{ top: 3, step: 1 },
	{ top: 6, step: 1 },
	{ top: 12, step: 2 },
	{ top: 24, step: 4 },
];

/** The length of one minute, in milliseconds. */
const MINUTE_MS = 60_000;

/** The length of one hour, in milliseconds. */
const HOUR_MS = 3_600_000;

/** The length of one day, in milliseconds. */
const DAY_MS = 24 * HOUR_MS;

/** The space above the highest bar, as a share of its height: the highest bar never touches the top of the chart. */
const HEADROOM = 1.1;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivityVerticalAxis
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Chooses the vertical axis of the histogram of the user activity time. The axis starts at 0, and its top fits the highest bar,
 * so a short activity in a long slot is still readable. The top is one of a few round values, and it is never more than the
 * length of the slot. The same slot length and the same highest bar always give the same axis, so the axis never keeps a
 * scale from an earlier choice.
 */
export class UserActivityVerticalAxis {
	/**
	 * Chooses the vertical axis.
	 *
	 * @param slotLengthId - The slot length of the histogram.
	 * @param tallestSlotMs - The user activity time of the busiest slot, in milliseconds. The slot is stacked, so this is the
	 * height of the highest bar.
	 * @returns The unit, the top, and the space between two lines of the axis.
	 */
	static of(slotLengthId: UserActivitySlotLengthId, tallestSlotMs: number): UserActivityVerticalAxisChoice {
		const slotMs = UserActivityVerticalAxis._slotLengthMs(slotLengthId);
		const unit: UserActivityHeightUnit = slotMs <= HOUR_MS ? "minutes" : "hours";
		const unitMs = unit === "minutes" ? MINUTE_MS : HOUR_MS;
		const tops = (unit === "minutes" ? MINUTE_TOPS : HOUR_TOPS).filter((candidate) => candidate.top * unitMs <= slotMs);
		const needed = (Math.max(0, tallestSlotMs) / unitMs) * HEADROOM;
		const chosen = tops.find((candidate) => candidate.top >= needed) ?? tops[tops.length - 1];
		return { unit, unitMs, top: chosen.top, step: chosen.step };
	}

	/**
	 * Gives the length of a slot, in milliseconds.
	 *
	 * @param slotLengthId - The slot length of the histogram.
	 * @returns The length of the slot, in milliseconds.
	 */
	private static _slotLengthMs(slotLengthId: UserActivitySlotLengthId): number {
		const { amount, unit } = USER_ACTIVITY_SLOT_LENGTHS[slotLengthId];
		const unitMs = unit === "minute" ? MINUTE_MS : unit === "hour" ? HOUR_MS : DAY_MS;
		return amount * unitMs;
	}
}
