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

/**
 * The range of a change log: the changes after one release, up to another release or up to the current commit.
 */
export type ChangeLogRange = {
	/** The release after which the changes start, or null for the start of the history. */
	fromTag: string | null;
	/** The release where the changes end, or null for the current commit. */
	toTag: string | null;
};

/**
 * Everything that the renderer needs to write one section of the change log.
 */
export type ChangeLogSectionInput = {
	/** The pull requests of the range. */
	mergedPullRequests: MergedPullRequest[];
	/** The web address of the GitHub repository, or null when it is not known. */
	repositoryUrl: string | null;
	/** The range of the section. */
	range: ChangeLogRange;
	/** The heading line of the section, for example `## [Unreleased]` or `## [0.2.0] - 2026-10-10`. */
	heading: string;
};
