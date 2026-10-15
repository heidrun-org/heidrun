import { z } from 'zod';
import { GameSettings } from './game_settings.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CommitTypes — the shape of one commit and of the file of commits
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * One commit of the history of a Git repository, as the game needs it. The script of `src/commit_export/` makes it.
 */
export type CommitRecord = {
	/** The hash of the commit. */
	hash: string;
	/** The date of the commit, in UTC, in the format of `Date.toISOString`. */
	committedAt: string;
	/** The first line of the message of the commit. */
	subject: string;
	/** The number of lines that the commit adds. For a merge commit, it is compared with the first parent. */
	insertions: number;
	/** The number of lines that the commit deletes. For a merge commit, it is compared with the first parent. */
	deletions: number;
	/** True when the commit has two parents or more. */
	isMerge: boolean;
	/** The lane of the commit, from 0 (far lane) to 2 (near lane). The line of the first parents is the middle lane. */
	lane: number;
};

/**
 * The file `commits.json`: the commits of a repository, from the oldest commit to the newest commit.
 */
export type CommitFile = {
	/** The commits, from the oldest commit to the newest commit. A parent always comes before its children. */
	commits: CommitRecord[];
};

/**
 * The schema that checks one commit of the file `commits.json`.
 */
export const CommitRecordSchema: z.ZodType<CommitRecord> = z.object({
	hash: z.string().min(1),
	committedAt: z.string().min(1),
	subject: z.string(),
	insertions: z.number().int().min(0),
	deletions: z.number().int().min(0),
	isMerge: z.boolean(),
	lane: z
		.number()
		.int()
		.min(0)
		.max(GameSettings.LANE_COUNT - 1),
});

/**
 * The schema that checks the file `commits.json`. The file must hold one commit at least.
 */
export const CommitFileSchema: z.ZodType<CommitFile> = z.object({
	commits: z.array(CommitRecordSchema).min(1),
});
