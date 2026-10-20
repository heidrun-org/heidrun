import ChildProcess from 'node:child_process';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WorktreeGit — the only code of the package that runs `git`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Runs the `git` commands that list and create worktrees.
 */
export class WorktreeGit {
	/**
	 * Lists the checkouts of the repository that holds a folder. The first one is the main checkout, and the others
	 * are the worktrees.
	 * @param workingDirectory A folder inside the main checkout or inside a worktree.
	 * @returns The absolute paths of the main checkout, then of every worktree.
	 * @throws An error when the folder is not inside a Git repository.
	 */
	static listCheckoutPaths(workingDirectory: string): string[] {
		const output = WorktreeGit._git(workingDirectory, ['worktree', 'list', '--porcelain']);
		const checkoutPaths: string[] = [];
		for (const line of output.split('\n')) {
			if (line.startsWith('worktree ') === true) {
				checkoutPaths.push(line.slice('worktree '.length));
			}
		}
		return checkoutPaths;
	}

	/**
	 * Finds the main checkout of the repository that holds a folder, even when the folder is inside a worktree.
	 * @param workingDirectory A folder inside the main checkout or inside a worktree.
	 * @returns The absolute path of the main checkout.
	 * @throws An error when the folder is not inside a Git repository.
	 */
	static findMainCheckoutPath(workingDirectory: string): string {
		const checkoutPaths = WorktreeGit.listCheckoutPaths(workingDirectory);
		const mainCheckoutPath = checkoutPaths[0];
		if (mainCheckoutPath === undefined) {
			throw new Error(`No Git checkout found from the folder: ${workingDirectory}`);
		}
		return mainCheckoutPath;
	}

	/**
	 * Tells if a name is valid for a Git branch.
	 * @param workingDirectory A folder inside the Git repository.
	 * @param name The name to test.
	 * @returns True when Git accepts the name as a branch name.
	 */
	static isBranchNameValid(workingDirectory: string, name: string): boolean {
		const result = ChildProcess.spawnSync('git', ['check-ref-format', '--branch', name], {
			cwd: workingDirectory,
			encoding: 'utf8',
		});
		return result.status === 0;
	}

	/**
	 * Creates a worktree on a new branch.
	 * @param mainCheckoutPath The absolute path of the main checkout.
	 * @param worktreePath The absolute path of the new worktree. The folder must not exist.
	 * @param branchName The name of the new branch.
	 * @param baseRef The commit, the branch, or the tag where the new branch starts.
	 * @returns Nothing.
	 * @throws An error when `git worktree add` fails, for example when the branch already exists.
	 */
	static addWorktree(mainCheckoutPath: string, worktreePath: string, branchName: string, baseRef: string): void {
		WorktreeGit._git(mainCheckoutPath, ['worktree', 'add', '--quiet', '-b', branchName, worktreePath, baseRef]);
	}

	/**
	 * Checks out the recorded commits of every submodule, including nested submodules.
	 * @param worktreePath The absolute path of the newly created worktree.
	 * @returns Nothing.
	 * @throws An error with the worktree path and the recovery command when initialization fails.
	 */
	static initializeSubmodules(worktreePath: string): void {
		try {
			WorktreeGit._git(worktreePath, ['submodule', 'update', '--init', '--recursive']);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(
				`The worktree ${worktreePath} was created, but its submodules could not be initialized. `
					+ 'Fix the cause, then run "git submodule update --init --recursive" and '
					+ `"pnpm install --frozen-lockfile" in the worktree.\n${message}`,
			);
		}
	}

	/**
	 * Runs one `git` command.
	 * @param workingDirectory The folder to run the command in.
	 * @param args The arguments of the `git` command.
	 * @returns The standard output of the command.
	 * @throws An error with the standard error output of `git` when the command fails.
	 */
	private static _git(workingDirectory: string, args: string[]): string {
		const result = ChildProcess.spawnSync('git', args, {
			cwd: workingDirectory,
			encoding: 'utf8',
		});
		if (result.status !== 0) {
			throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
		}
		return result.stdout;
	}
}
