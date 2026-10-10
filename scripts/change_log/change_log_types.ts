///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ChangeLogTypes — the data shapes shared by the files of the change log generator
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * One pull request that was merged after the last release.
 */
export type MergedPullRequest = {
	/** The number of the pull request, for example `116`. */
	number: number;
	/** The name of the branch that the pull request merged, with the owner, for example `heidrun-org/fix-bug-12`. */
	branchName: string;
	/** The title of the pull request: the first line of the body of the merge commit, or the branch name. */
	title: string;
	/** The full message of the merge commit: the subject line, a blank line, and the body. */
	message: string;
};
