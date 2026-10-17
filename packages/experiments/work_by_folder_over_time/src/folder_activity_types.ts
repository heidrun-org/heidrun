///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The changed line counts and commit count for one folder in a ten-minute interval. */
export type FolderActivitySlot = {
	/** The UTC start time of the ten-minute interval. */
	utcStart: string;
	/** The number of lines added to files in the folder. */
	addedLines: number;
	/** The number of lines deleted from files in the folder. */
	deletedLines: number;
	/** The number of changed lines, equal to lines added plus lines deleted. */
	changedLines: number;
	/** The number of distinct commits that changed a file in the folder. */
	commitCount: number;
};

/** The totals and interval activity for one folder containing changed files. */
export type FolderActivity = {
	/** The folder path relative to the selected workspace folder; `.` means its top level. */
	folderPath: string;
	/** The total number of lines added to files in the folder. */
	addedLines: number;
	/** The total number of lines deleted from files in the folder. */
	deletedLines: number;
	/** The total number of changed lines, equal to lines added plus lines deleted. */
	changedLines: number;
	/** The number of distinct commits that changed files in the folder. */
	commitCount: number;
	/** The activity in each ten-minute interval with a change in the folder. */
	slots: FolderActivitySlot[];
};

/** The complete input summary and grouped activity shown by the report. */
export type FolderActivityReportData = {
	/** The resolved filesystem path of the selected workspace folder. */
	workspaceFolder: string;
	/** The inclusive start instant, normalized to ISO 8601 UTC. */
	startTime: string;
	/** The exclusive end instant, normalized to ISO 8601 UTC. */
	endTime: string;
	/** The subfolders that currently exist inside the selected workspace folder. */
	workspaceFolders: string[];
	/** The folders with changed files, sorted by folder path. */
	folders: FolderActivity[];
};

/** One per-file change reported by Git for a commit. */
export type GitFileChange = {
	/** The repository-relative path of the changed file. */
	filePath: string;
	/** The number of lines added to the file, or zero for a binary file. */
	addedLines: number;
	/** The number of lines deleted from the file, or zero for a binary file. */
	deletedLines: number;
};

/** A commit date and its per-file line changes. */
export type GitCommitActivity = {
	/** The commit identifier. */
	hash: string;
	/** The committer date as an ISO 8601 UTC timestamp. */
	committedAt: string;
	/** The per-file line changes reported by Git. */
	fileChanges: GitFileChange[];
};

/** The repository and workspace paths used to interpret Git file paths. */
export type GitWorkspace = {
	/** The resolved root folder of the Git repository. */
	repositoryFolder: string;
	/** The folder selected by the caller. */
	workspaceFolder: string;
	/** The workspace folder relative to the repository root, using `/` separators. */
	workspaceRelativePath: string;
};
