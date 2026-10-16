import {
	UserActivitySlots,
	type UserActivityPeriodTimes,
	type UserActivityRangeId,
	type UserActivitySlot,
	type UserActivitySlotLengthId,
} from "./user_activity_slots";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivityWorkspaces — lists the workspaces that the histogram can show, gives each one a color, and cuts the user
//	activity time of each one into slots
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One workspace that the developer can choose to show or to hide. */
export type UserActivityWorkspaceChoice = {
	/** The folder of the workspace. It tells two workspaces apart. */
	folder: string;
	/** The text on the button of the workspace. */
	name: string;
};

/** A workspace that is open now: the folder of the workspace and the label of the workspace in the left sidebar. */
export type UserActivityOpenWorkspace = {
	/** The folder of the workspace, or `null` when the workspace has no folder yet. */
	folder: string | null;
	/** The label of the workspace. */
	label: string;
};

/** The user activity time of one workspace, cut into slots. It is one part of each stacked bar of the histogram. */
export type UserActivityWorkspaceSlots = {
	/** The folder of the workspace. */
	folder: string;
	/** The name of the workspace, the same as on its button. */
	name: string;
	/** The name of the CSS variable that gives the color of the workspace, for example `--blue-500`. */
	colorToken: string;
	/** The slots of the workspace, the oldest first. */
	slots: UserActivitySlot[];
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Constants
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The colors of the workspaces in the histogram, as the names of CSS variables of the color scales of Bootstrap. A
 * workspace takes the color at its place in the list of the choices, which is sorted by name. The list starts again from
 * the first color after the last color.
 */
export const USER_ACTIVITY_WORKSPACE_COLOR_TOKENS: readonly string[] = [
	"--blue-500",
	"--orange-500",
	"--green-500",
	"--purple-500",
	"--red-500",
	"--teal-500",
	"--yellow-500",
	"--pink-500",
];

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Workspaces
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export class UserActivityWorkspaces {
	/**
	 * Lists the workspaces that the developer can choose: every folder of a record, and the folder of the workspace that
	 * runs an active period now. A workspace that is open takes its label. A workspace that is closed, for example one
	 * whose worktree was removed, takes the last part of its folder. When two workspaces have the same name, the folder
	 * follows the name in parentheses, so that the developer can tell them apart.
	 *
	 * @param records - The active periods that ended. Only the folder of each record is read.
	 * @param runningPeriodFolder - The folder of the workspace that runs an active period now, or `null` when none runs.
	 * @param openWorkspaces - The workspaces that are open now.
	 * @returns The choices, sorted by name.
	 */
	static choices(
		records: readonly { workspaceFolder: string }[],
		runningPeriodFolder: string | null,
		openWorkspaces: readonly UserActivityOpenWorkspace[],
	): UserActivityWorkspaceChoice[] {
		const folders = new Set<string>(records.map((record) => record.workspaceFolder));
		if (runningPeriodFolder !== null) {
			folders.add(runningPeriodFolder);
		}
		const named = [...folders].map((folder) => {
			const openWorkspace = openWorkspaces.find((candidate) => candidate.folder === folder && candidate.label !== "");
			return { folder, name: openWorkspace?.label ?? UserActivityWorkspaces._lastPartOf(folder) };
		});
		const choices = named.map((choice) => {
			const isShared = named.some((other) => other.folder !== choice.folder && other.name === choice.name);
			return { folder: choice.folder, name: isShared === true ? `${choice.name} (${choice.folder})` : choice.name };
		});
		return choices.sort((a, b) => a.name.localeCompare(b.name) || a.folder.localeCompare(b.folder));
	}

	/**
	 * Gives the color of a workspace. The color depends only on the place of the workspace in the list of the choices, so
	 * it stays the same in every slot, every time range, and every slot length, and when the developer hides a workspace.
	 *
	 * @param index - The place of the workspace in the list of the choices.
	 * @returns The name of the CSS variable that gives the color, for example `--blue-500`.
	 */
	static colorToken(index: number): string {
		return USER_ACTIVITY_WORKSPACE_COLOR_TOKENS[index % USER_ACTIVITY_WORKSPACE_COLOR_TOKENS.length];
	}

	/**
	 * Cuts the user activity time of each chosen workspace into slots. The running active period counts only in the
	 * slots of its own workspace.
	 *
	 * @param choices - The workspaces that the developer can choose, sorted by name.
	 * @param chosenFolders - The folders of the chosen workspaces.
	 * @param records - The active periods that ended.
	 * @param runningPeriodStartedAt - The start of the active period that runs now, or `null` when no period runs.
	 * @param runningPeriodFolder - The folder of the workspace of the running period, or `null` when none is selected.
	 * @param now - The current time, in milliseconds.
	 * @param rangeId - The range. The default is the last day.
	 * @param slotLengthId - The slot length. The default is the slot length that the range starts with.
	 * @returns One entry for each chosen workspace, in the order of the choices.
	 */
	static slotsByWorkspace(
		choices: readonly UserActivityWorkspaceChoice[],
		chosenFolders: readonly string[],
		records: readonly (UserActivityPeriodTimes & { workspaceFolder: string })[],
		runningPeriodStartedAt: number | null,
		runningPeriodFolder: string | null,
		now: number,
		rangeId: UserActivityRangeId = "day",
		slotLengthId?: UserActivitySlotLengthId,
	): UserActivityWorkspaceSlots[] {
		const workspaceSlots: UserActivityWorkspaceSlots[] = [];
		for (const [index, choice] of choices.entries()) {
			if (chosenFolders.includes(choice.folder) === false) {
				continue;
			}
			workspaceSlots.push({
				folder: choice.folder,
				name: choice.name,
				colorToken: UserActivityWorkspaces.colorToken(index),
				slots: UserActivitySlots.compute(
					UserActivityWorkspaces.filterRecords(records, [choice.folder]),
					UserActivityWorkspaces.runningPeriodStartedAt(runningPeriodStartedAt, runningPeriodFolder, [choice.folder]),
					now,
					rangeId,
					slotLengthId,
				),
			});
		}
		return workspaceSlots;
	}

	/**
	 * Keeps the records of the chosen workspaces.
	 *
	 * @param records - The active periods that ended.
	 * @param chosenFolders - The folders of the chosen workspaces.
	 * @returns The records whose workspace is chosen, in the same order.
	 */
	static filterRecords<RecordType extends { workspaceFolder: string }>(
		records: readonly RecordType[],
		chosenFolders: readonly string[],
	): RecordType[] {
		const chosen = new Set(chosenFolders);
		return records.filter((record) => chosen.has(record.workspaceFolder));
	}

	/**
	 * Gives the start of the running active period when its workspace is chosen. The running period belongs to the
	 * selected workspace.
	 *
	 * @param runningPeriodStartedAt - The start of the running period, or `null` when no period runs.
	 * @param runningPeriodFolder - The folder of the workspace of the running period, or `null` when none is selected.
	 * @param chosenFolders - The folders of the chosen workspaces.
	 * @returns The start of the running period, or `null` when no period runs or its workspace is not chosen.
	 */
	static runningPeriodStartedAt(
		runningPeriodStartedAt: number | null,
		runningPeriodFolder: string | null,
		chosenFolders: readonly string[],
	): number | null {
		if (runningPeriodStartedAt === null || runningPeriodFolder === null) {
			return null;
		}
		return chosenFolders.includes(runningPeriodFolder) === true ? runningPeriodStartedAt : null;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Gives the last part of a folder: the name of the folder itself, with no parent.
	 *
	 * @param folder - The folder, with slashes or backslashes.
	 * @returns The last part, or the whole folder when it has no part.
	 */
	private static _lastPartOf(folder: string): string {
		const parts = folder.split(/[\\/]/).filter((part) => part !== "");
		return parts.length === 0 ? folder : parts[parts.length - 1];
	}
}
