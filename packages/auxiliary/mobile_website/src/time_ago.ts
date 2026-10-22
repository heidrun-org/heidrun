///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TimeAgo — says how long ago a status changed
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Writes the age of a status in a few words.
 */
export class TimeAgo {
	/**
	 * Gives the age of a status.
	 * @param since The time of the change, in milliseconds since 1970, or null when it is not known.
	 * @param now The current time, in milliseconds since 1970.
	 * @returns "just now", "5 min ago", "2 h ago", or an empty text when the time is not known.
	 */
	static format(since: number | null, now: number): string {
		if (since === null || since === 0) {
			return '';
		}
		const minutes = Math.round((now - since) / 60000);
		if (minutes < 1) {
			return 'just now';
		}
		if (minutes < 60) {
			return `${minutes} min ago`;
		}
		return `${Math.round(minutes / 60)} h ago`;
	}
}
