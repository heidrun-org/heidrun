///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The result of `WorktreeCreate.run`.
 */
export type WorktreeCreateResult = {
	/** The absolute path of the new worktree. */
	worktreePath: string;
	/** The name of the new branch that the worktree has checked out. */
	branchName: string;
	/** True when the debug build and bundled command line tools were cloned into the new worktree. */
	isTargetCloned: boolean;
	/** The reason why the clone did not happen, or null when the clone happened. */
	skipReason: string | null;
};

/**
 * The Cargo target folder of one worktree that no build has used for some days.
 */
export type StaleTargetFolder = {
	/** The absolute path of the worktree that owns the target folder. */
	worktreePath: string;
	/** The absolute path of the Cargo target folder. */
	targetPath: string;
	/** The most recent modification time of any file or folder inside the target folder. */
	lastUsed: Date;
	/** The number of whole days between `lastUsed` and now. */
	ageInDays: number;
};
