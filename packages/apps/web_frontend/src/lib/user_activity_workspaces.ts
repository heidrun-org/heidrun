///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserActivityWorkspaces — lists the workspaces that the histogram can show, and filters the records by them
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
