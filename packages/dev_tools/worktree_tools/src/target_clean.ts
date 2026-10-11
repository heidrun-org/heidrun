import Fs from 'node:fs';
import Path from 'node:path';
import { TargetPaths } from './target_paths.ts';
import { WorktreeGit } from './worktree_git.ts';
import type { StaleTargetFolder } from './worktree_tools_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TargetClean — finds and deletes the Cargo target folders of the worktrees that no build has used for some days
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Finds the Cargo target folders of the worktrees that no build has used for some days, and deletes them. It never
 * touches the target folder of the main checkout.
 */
export class TargetClean {
	/** The number of milliseconds in one day. */
	static readonly millisecondsPerDay = 24 * 60 * 60 * 1000;

	/** The number of days without a build after which a target folder is stale, when the caller gives none. */
	static readonly defaultMinimumAgeInDays = 7;

	/**
	 * Finds the stale target folders. A target folder is stale when no file and no folder inside it changed during the
	 * last `minimumAgeInDays` days. A build changes files inside the target folder, so a stale folder is a folder that
	 * no build has used. The method deletes nothing.
	 * @param options.workingDirectory A folder inside the main checkout or inside a worktree.
	 * @param options.minimumAgeInDays The number of days without a change after which a target folder is stale.
	 * @param options.now The current time.
	 * @returns The stale target folders, the oldest first. The target folder of the main checkout is never in it.
	 * @throws An error when the folder is not inside a Git repository.
	 */
	static findStale(options: {
		workingDirectory: string;
		minimumAgeInDays: number;
		now: Date;
	}): StaleTargetFolder[] {
		const worktreePaths = WorktreeGit.listCheckoutPaths(options.workingDirectory).slice(1);
		const staleTargetFolders: StaleTargetFolder[] = [];
		for (const worktreePath of worktreePaths) {
			const targetPath = TargetPaths.targetPath(worktreePath);
			if (Fs.existsSync(targetPath) === false) {
				continue;
			}
			const lastUsed = TargetClean._findNewestModificationTime(targetPath);
			const ageInMilliseconds = options.now.getTime() - lastUsed.getTime();
			if (ageInMilliseconds < options.minimumAgeInDays * TargetClean.millisecondsPerDay) {
				continue;
			}
			staleTargetFolders.push({
				worktreePath,
				targetPath,
				lastUsed,
				ageInDays: Math.floor(ageInMilliseconds / TargetClean.millisecondsPerDay),
			});
		}
		return staleTargetFolders.sort((first, second) => {
			return first.lastUsed.getTime() - second.lastUsed.getTime();
		});
	}

	/**
	 * Deletes target folders.
	 * @param staleTargetFolders The folders to delete, from `findStale`.
	 * @returns Nothing.
	 */
	static remove(staleTargetFolders: StaleTargetFolder[]): void {
		for (const staleTargetFolder of staleTargetFolders) {
			Fs.rmSync(staleTargetFolder.targetPath, { recursive: true, force: true });
		}
	}

	/**
	 * Finds the most recent modification time of a folder, of its subfolders, and of its files. The method does not
	 * follow symbolic links.
	 * @param folderPath The absolute path of the folder.
	 * @returns The most recent modification time.
	 */
	private static _findNewestModificationTime(folderPath: string): Date {
		let newestMilliseconds = Fs.lstatSync(folderPath).mtimeMs;
		const pendingFolderPaths = [folderPath];
		while (pendingFolderPaths.length > 0) {
			const currentFolderPath = pendingFolderPaths.pop() as string;
			for (const entry of Fs.readdirSync(currentFolderPath, { withFileTypes: true })) {
				const entryPath = Path.join(currentFolderPath, entry.name);
				const entryMilliseconds = Fs.lstatSync(entryPath).mtimeMs;
				newestMilliseconds = Math.max(newestMilliseconds, entryMilliseconds);
				if (entry.isDirectory() === true) {
					pendingFolderPaths.push(entryPath);
				}
			}
		}
		return new Date(newestMilliseconds);
	}
}
