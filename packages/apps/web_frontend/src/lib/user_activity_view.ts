import type { UserActivityEndReason, UserActivityRecord } from "./user_activity";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivityView — turns the records of the user activity into the lines that the sidebar section shows
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One line of the list of the last active periods. */
export type UserActivityRow = {
	/** The text that tells this line from the other lines. */
	key: string;
	/** The folder of the workspace. */
	workspaceFolder: string;
	/** The times of the start and of the end of the period, as `19:52:03 → 19:52:08`. */
	timeRange: string;
	/** The length of the period, as `5 s`, `3 min 12 s`, or `1 h 05 min 07 s`. */
	duration: string;
	/** The number of keyboard actions of the period. */
	keyboardActionCount: number;
	/** The number of mouse actions of the period. */
	mouseActionCount: number;
	/** The reason why the period ended. */
	endReason: UserActivityEndReason;
};

/** The total time of one folder. */
export type UserActivityTotal = {
	/** The folder of the workspace. */
	workspaceFolder: string;
	/** The total time of the active periods of the folder, in milliseconds. */
	durationMs: number;
};

/** The most lines that the list of the last active periods shows. */
export const USER_ACTIVITY_ROW_LIMIT = 30;

/** The functions that build what the sidebar section of the user activity shows. They read no clock and no store. */
export class UserActivityView {
	/**
	 * Gives the length of a period.
	 *
	 * @param record - The record of the period.
	 * @returns The time from the start to the end of the period, in milliseconds, or 0 when a time is not a date.
	 */
	static durationMs(record: UserActivityRecord): number {
		const length = Date.parse(record.endedAt) - Date.parse(record.startedAt);
		return Number.isNaN(length) ? 0 : Math.max(0, length);
	}

	/**
	 * Writes a length of time with its seconds.
	 *
	 * @param durationMs - The length of time, in milliseconds.
	 * @returns For example `5 s`, `3 min 12 s`, or `1 h 05 min 07 s`.
	 */
	static formatDuration(durationMs: number): string {
		const totalSeconds = Math.round(durationMs / 1_000);
		const hours = Math.floor(totalSeconds / 3_600);
		const minutes = Math.floor((totalSeconds % 3_600) / 60);
		const seconds = totalSeconds % 60;
		if (hours > 0) {
			return `${hours} h ${String(minutes).padStart(2, "0")} min ${String(seconds).padStart(2, "0")} s`;
		}
		if (minutes > 0) {
			return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
		}
		return `${seconds} s`;
	}

	/**
	 * Gives the time of the day of an ISO 8601 text, as it is written in the text.
	 *
	 * @param isoTime - A time such as `2026-10-14T19:52:03.412+02:00`.
	 * @returns The time of the day, such as `19:52:03`.
	 */
	static timeOfDay(isoTime: string): string {
		return isoTime.slice(11, 19);
	}

	/**
	 * Builds the lines of the list of the last active periods.
	 *
	 * @param records - The records, the oldest first.
	 * @param limit - The most lines to give.
	 * @returns The lines, the newest first.
	 */
	static rows(records: readonly UserActivityRecord[], limit = USER_ACTIVITY_ROW_LIMIT): UserActivityRow[] {
		return records
			.slice(-limit)
			.reverse()
			.map((record) => ({
				key: `${record.workspaceFolder}|${record.startedAt}|${record.endedAt}`,
				workspaceFolder: record.workspaceFolder,
				timeRange: `${UserActivityView.timeOfDay(record.startedAt)} → ${UserActivityView.timeOfDay(record.endedAt)}`,
				duration: UserActivityView.formatDuration(UserActivityView.durationMs(record)),
				keyboardActionCount: record.keyboardActionCount,
				mouseActionCount: record.mouseActionCount,
				endReason: record.endReason,
			}));
	}

	/**
	 * Adds up the length of the periods of each folder.
	 *
	 * @param records - The records.
	 * @returns One total for each folder, the longest first.
	 */
	static totalsByFolder(records: readonly UserActivityRecord[]): UserActivityTotal[] {
		const totals = new Map<string, number>();
		for (const record of records) {
			totals.set(record.workspaceFolder, (totals.get(record.workspaceFolder) ?? 0) + UserActivityView.durationMs(record));
		}
		return [...totals.entries()]
			.map(([workspaceFolder, durationMs]) => ({ workspaceFolder, durationMs }))
			.sort((first, second) => second.durationMs - first.durationMs);
	}
}
