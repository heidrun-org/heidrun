import Path from 'node:path';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TargetPaths — the place of the Cargo target folder inside a checkout of the repository
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Gives the paths of the Cargo target folder of the package `desktop_tauri` inside one checkout: the main checkout or a
 * worktree.
 */
export class TargetPaths {
	/** The path of the Cargo target folder, relative to the root of a checkout. */
	static readonly targetRelativePath = Path.join('packages', 'apps', 'desktop_tauri', 'target');

	/** The name of the folder, inside the Cargo target folder, that holds the debug build. */
	static readonly debugFolderName = 'debug';

	/**
	 * Gives the path of the Cargo target folder of a checkout.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @returns The absolute path of the Cargo target folder.
	 */
	static targetPath(checkoutPath: string): string {
		return Path.join(checkoutPath, TargetPaths.targetRelativePath);
	}

	/**
	 * Gives the path of the debug build folder of a checkout.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @returns The absolute path of the `debug` folder inside the Cargo target folder.
	 */
	static debugPath(checkoutPath: string): string {
		return Path.join(TargetPaths.targetPath(checkoutPath), TargetPaths.debugFolderName);
	}
}
