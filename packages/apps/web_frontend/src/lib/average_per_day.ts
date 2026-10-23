///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AveragePerDay — divides a total by the number of days of a time range, and writes the result
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The average per day of the tab "Work of one person" of the Statistics window: the total of a time range divided by the
 * number of days of the time range. Every day counts, also a day with no work.
 */
export class AveragePerDay {
	/**
	 * Divides a total by the number of days of the time range.
	 *
	 * @param total - The total of the time range: a number of items, of lines, or a cost in US dollars.
	 * @param dayCount - The number of days of the time range, today included.
	 * @returns The average per day, or 0 when the time range has no day.
	 */
	static of(total: number, dayCount: number): number {
		return dayCount > 0 ? total / dayCount : 0;
	}

	/**
	 * Writes an average of items or of lines as the language of the interface writes a number: with at most one decimal
	 * digit, and with two decimal digits when the average is more than 0 and less than 1, so that one item in 30 days is
	 * "0.03" and not "0".
	 *
	 * @param average - The average per day, from `of`.
	 * @param locale - The language of the interface, for example `en` or `fr`.
	 * @returns The text, for example "71.1" in English and "71,1" in French.
	 */
	static countText(average: number, locale: string): string {
		const isBelowOne = average > 0 && average < 1;
		return average.toLocaleString(locale, { maximumFractionDigits: isBelowOne ? 2 : 1 });
	}
}
