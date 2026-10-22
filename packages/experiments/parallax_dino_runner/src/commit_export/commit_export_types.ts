///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CommitExportTypes — the commit as the command git gives it
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * One commit as the command `git log` gives it, before the script gives it a lane.
 */
export type RawCommit = {
	/** The hash of the commit. */
	hash: string;
	/** The hashes of the parents of the commit. The list is empty for the first commit. */
	parents: string[];
	/** The date of the commit, in UTC, in the format of `Date.toISOString`. */
	committedAt: string;
	/** The first line of the message of the commit. */
	subject: string;
	/** The number of lines that the commit adds. For a merge commit, it is compared with the first parent. */
	insertions: number;
	/** The number of lines that the commit deletes. For a merge commit, it is compared with the first parent. */
	deletions: number;
};
