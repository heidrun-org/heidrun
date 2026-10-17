import Path from 'node:path';
import type {
	FolderActivity,
	FolderActivityReportData,
	FolderActivitySlot,
	GitCommitActivity,
	GitWorkspace,
} from './folder_activity_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FolderActivityBuilder — groups Git line changes by folder and ten-minute interval
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const TEN_MINUTES_MILLISECONDS = 10 * 60 * 1000;

type MutableFolderActivitySlot = {
	/** The number of lines added so far. */
	addedLines: number;
	/** The number of lines deleted so far. */
	deletedLines: number;
	/** The distinct commits that changed a file in this folder and interval. */
	commitHashes: Set<string>;
};

/** Groups commits by workspace-relative folder and ten-minute UTC interval. */
export class FolderActivityBuilder {
	/**
	 * Builds the report data for the selected workspace and time range.
	 * @param gitWorkspace The repository and workspace paths.
	 * @param commits The commits read from the repository.
	 * @param workspaceFolders The folder paths that currently exist in the workspace.
	 * @param startTime The inclusive start instant.
	 * @param endTime The exclusive end instant.
	 * @returns The report data, grouped by folder and ten-minute interval.
	 */
	static build(
		gitWorkspace: GitWorkspace,
		commits: GitCommitActivity[],
		workspaceFolders: string[],
		startTime: Date,
		endTime: Date,
	): FolderActivityReportData {
		const folders = new Map<string, Map<string, MutableFolderActivitySlot>>();
		for (const gitCommitActivity of commits) {
			const committedAt = new Date(gitCommitActivity.committedAt);
			if (committedAt < startTime || committedAt >= endTime) {
				continue;
			}
			const intervalStart = new Date(
				Math.floor(committedAt.getTime() / TEN_MINUTES_MILLISECONDS) * TEN_MINUTES_MILLISECONDS,
			).toISOString();
			const changedFolders = new Set<string>();
			for (const gitFileChange of gitCommitActivity.fileChanges) {
				const relativeFilePath = FolderActivityBuilder._relativeFilePath(
					gitWorkspace.workspaceRelativePath,
					gitFileChange.filePath,
				);
				if (relativeFilePath === null) {
					continue;
				}
				const folderPath = Path.posix.dirname(relativeFilePath);
				let intervalMap = folders.get(folderPath);
				if (intervalMap === undefined) {
					intervalMap = new Map();
					folders.set(folderPath, intervalMap);
				}
				let mutableSlot = intervalMap.get(intervalStart);
				if (mutableSlot === undefined) {
					mutableSlot = {
						addedLines: 0,
						deletedLines: 0,
						commitHashes: new Set(),
					};
					intervalMap.set(intervalStart, mutableSlot);
				}
				mutableSlot.addedLines += gitFileChange.addedLines;
				mutableSlot.deletedLines += gitFileChange.deletedLines;
				changedFolders.add(folderPath);
			}
			for (const folderPath of changedFolders) {
				folders.get(folderPath)?.get(intervalStart)?.commitHashes.add(gitCommitActivity.hash);
			}
		}
		return {
			workspaceFolder: gitWorkspace.workspaceFolder,
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			workspaceFolders,
			folders: FolderActivityBuilder._folderActivities(folders),
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Returns a file path relative to the workspace, or `null` when the file is outside it.
	 * @param workspaceRelativePath The workspace path relative to the repository root.
	 * @param repositoryRelativeFilePath The path reported by Git.
	 * @returns The path inside the workspace, or `null` for an out-of-scope path.
	 */
	private static _relativeFilePath(workspaceRelativePath: string, repositoryRelativeFilePath: string): string | null {
		if (workspaceRelativePath === '') {
			return repositoryRelativeFilePath;
		}
		const workspacePrefix = `${workspaceRelativePath}/`;
		if (repositoryRelativeFilePath.startsWith(workspacePrefix) === false) {
			return null;
		}
		return repositoryRelativeFilePath.slice(workspacePrefix.length);
	}

	/**
	 * Converts the mutable folder and interval maps to sorted folder records.
	 * @param folders The grouped activity accumulated from commits.
	 * @returns Sorted activity records with folder and overall totals.
	 */
	private static _folderActivities(
		folders: Map<string, Map<string, MutableFolderActivitySlot>>,
	): FolderActivity[] {
		const folderActivities: FolderActivity[] = [];
		for (const [folderPath, intervalMap] of folders.entries()) {
			const slots: FolderActivitySlot[] = [...intervalMap.entries()]
				.sort(([firstTime], [secondTime]) => firstTime.localeCompare(secondTime))
				.map(([utcStart, mutableSlot]) => ({
					utcStart,
					addedLines: mutableSlot.addedLines,
					deletedLines: mutableSlot.deletedLines,
					changedLines: mutableSlot.addedLines + mutableSlot.deletedLines,
					commitCount: mutableSlot.commitHashes.size,
				}));
			const addedLines = slots.reduce((total, slot) => total + slot.addedLines, 0);
			const deletedLines = slots.reduce((total, slot) => total + slot.deletedLines, 0);
			const commitHashes = new Set<string>();
			for (const mutableSlot of intervalMap.values()) {
				for (const commitHash of mutableSlot.commitHashes) {
					commitHashes.add(commitHash);
				}
			}
			folderActivities.push({
				folderPath,
				addedLines,
				deletedLines,
				changedLines: addedLines + deletedLines,
				commitCount: commitHashes.size,
				slots,
			});
		}
		return folderActivities.sort(
			(firstFolder, secondFolder) => firstFolder.folderPath.localeCompare(secondFolder.folderPath),
		);
	}
}
