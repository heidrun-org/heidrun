import { z } from 'zod';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DataLayerRowTypes — the facts that the builder reads from the column data of each table
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// The JSON schemas of the data layer packages are the only place that says which facts the column `data` stores.
// These schemas list only the facts that the multi-layer graph uses, and Zod drops the other facts.

/**
 * The facts of one issue, from the column `data` of the table `issues`.
 */
export const IssueRowSchema = z.object({
	/** The number of the issue. */
	number: z.number().int(),
	/** The title of the issue. */
	title: z.string(),
	/** The text of the issue. */
	body: z.string(),
	/** "OPEN" or "CLOSED". */
	state: z.string(),
	/** The login on GitHub of the author, or null when GitHub does not know the author. */
	author: z.string().nullable(),
	/** The labels of the issue. */
	labels: z.array(z.string()),
	/** The date of the creation, in ISO 8601 format. */
	createdAt: z.string(),
	/** The date of the close, or null. */
	closedAt: z.string().nullable(),
	/** The number of comments. */
	commentCount: z.number().int(),
});

/**
 * The facts of one issue, from the column `data` of the table `issues`.
 */
export type IssueRow = z.infer<typeof IssueRowSchema>;

/**
 * The facts of one pull request, from the column `data` of the table `pull_requests`.
 */
export const PullRequestRowSchema = z.object({
	/** The number of the pull request. */
	number: z.number().int(),
	/** The title of the pull request. */
	title: z.string(),
	/** The text of the pull request. */
	body: z.string(),
	/** "OPEN", "CLOSED", or "MERGED". */
	state: z.string(),
	/** The login on GitHub of the author, or null when GitHub does not know the author. */
	author: z.string().nullable(),
	/** The branch that the pull request goes into. */
	baseRefName: z.string(),
	/** The branch of the change. */
	headRefName: z.string(),
	/** The hash of the merge commit, or null. */
	mergeCommit: z.string().nullable(),
	/** The date of the creation, in ISO 8601 format. */
	createdAt: z.string(),
	/** The date of the merge, or null. */
	mergedAt: z.string().nullable(),
	/** The number of lines added. */
	additions: z.number().int(),
	/** The number of lines deleted. */
	deletions: z.number().int(),
	/** The number of files changed. */
	changedFiles: z.number().int(),
	/** The number of commits. */
	commitCount: z.number().int(),
});

/**
 * The facts of one pull request, from the column `data` of the table `pull_requests`.
 */
export type PullRequestRow = z.infer<typeof PullRequestRowSchema>;

/**
 * The facts of one commit, from the column `data` of the table `commits`.
 */
export const CommitRowSchema = z.object({
	/** The hash of the commit. */
	hash: z.string(),
	/** The hashes of the parents. A merge has two parents or more. */
	parents: z.array(z.string()),
	/** The name of the author. */
	authorName: z.string(),
	/** The email of the author. */
	authorEmail: z.string(),
	/** The date of the commit, in ISO 8601 format and in UTC. */
	committedAt: z.string(),
	/** The first line of the message. */
	subject: z.string(),
	/** The message after the first line. */
	body: z.string(),
	/** The number of files changed. */
	filesChanged: z.number().int(),
	/** The number of lines added. */
	insertions: z.number().int(),
	/** The number of lines deleted. */
	deletions: z.number().int(),
});

/**
 * The facts of one commit, from the column `data` of the table `commits`.
 */
export type CommitRow = z.infer<typeof CommitRowSchema>;
