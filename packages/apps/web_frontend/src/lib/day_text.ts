import { locale } from "../i18n/index";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DayText — writes a day for the axis and for the chart information card of a bar chart
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The number of days up to which the axis names the weekday of each day. A longer time range gives the date only. */
const LAST_DAY_COUNT_WITH_WEEKDAY = 7;

/** The text of a day, in the language in use. */
export class DayText {
	/**
	 * Writes a day under a bar: the weekday and the date for a time range of seven days or less, else the date only.
	 *
	 * @param time - The start of the day, in milliseconds since 1 January 1970.
	 * @param dayCount - The number of days of the time range.
	 * @returns The text, for example "Mon, Oct 12" or "Oct 12".
	 */
	static axis(time: number, dayCount: number): string {
		if (dayCount > LAST_DAY_COUNT_WITH_WEEKDAY) {
			return new Date(time).toLocaleDateString(locale.value, { day: "numeric", month: "short" });
		}
		return new Date(time).toLocaleDateString(locale.value, { weekday: "short", day: "numeric", month: "short" });
	}

	/**
	 * Writes a day for the title of the chart information card of a bar: the long form.
	 *
	 * @param time - The start of the day, in milliseconds since 1 January 1970.
	 * @returns The text, for example "Monday, October 12".
	 */
	static cardTitle(time: number): string {
		return new Date(time).toLocaleDateString(locale.value, { weekday: "long", day: "numeric", month: "long" });
	}
}
