///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CalendarDays — cuts a time range of whole days, in the time zone of the computer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One day. Every time is in milliseconds since 1 January 1970. */
export type CalendarDay = {
	/** The start of the day: midnight, in the time zone of the computer. */
	startedAt: number;
	/** The end of the day: the midnight after the start. */
	endedAt: number;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CalendarDays
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The days of a time range that ends today. It has no clock: the caller gives the current time. A day goes from one
 * midnight to the next midnight of the time zone of the computer, so a day is 23 or 25 hours long when the clock changes.
 */
export class CalendarDays {
	/**
	 * Gives the start of the first day of a time range: midnight, `dayCount - 1` days before the day of `now`.
	 *
	 * @param now - The current time, in milliseconds since 1 January 1970.
	 * @param dayCount - The number of days of the time range, today included.
	 * @returns The start of the first day, in milliseconds since 1 January 1970.
	 */
	static firstDayStartedAt(now: number, dayCount: number): number {
		const today = new Date(now);
		return new Date(today.getFullYear(), today.getMonth(), today.getDate() - (dayCount - 1)).getTime();
	}

	/**
	 * Gives the end of the day of `now`: the next midnight. A time range that ends there never cuts an item that a clock
	 * a little late or a little early would put a few seconds in the future.
	 *
	 * @param now - The current time, in milliseconds since 1 January 1970.
	 * @returns The next midnight, in milliseconds since 1 January 1970.
	 */
	static endOfTodayAt(now: number): number {
		const today = new Date(now);
		return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
	}

	/**
	 * Gives the days of a time range.
	 *
	 * @param now - The current time, in milliseconds since 1 January 1970.
	 * @param dayCount - The number of days of the time range, today included.
	 * @returns The days, the oldest first. The last day is today.
	 */
	static build(now: number, dayCount: number): CalendarDay[] {
		const today = new Date(now);
		const days: CalendarDay[] = [];
		for (let index = 0; index < dayCount; index += 1) {
			const offset = index - (dayCount - 1);
			days.push({
				startedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset).getTime(),
				endedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset + 1).getTime(),
			});
		}
		return days;
	}

	/**
	 * Finds the day that holds a time.
	 *
	 * @param days - The days of the time range.
	 * @param timeText - A time, an ISO 8601 text.
	 * @returns The index of the day, or `-1` when the time is outside the days or is not a time.
	 */
	static findIndex(days: CalendarDay[], timeText: string): number {
		const time = Date.parse(timeText);
		if (Number.isNaN(time) === true) {
			return -1;
		}
		return days.findIndex((day) => time >= day.startedAt && time < day.endedAt);
	}
}
