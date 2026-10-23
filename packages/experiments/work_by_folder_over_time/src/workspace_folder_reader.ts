import Fs from 'node:fs';
import Path from 'node:path';
import type { GitWorkspace } from './folder_activity_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WorkspaceFolderReader — reads current folders from the selected workspace
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Reads the current directory hierarchy of a workspace folder. */
export class WorkspaceFolderReader {
	/** Directories that contain generated output, dependencies, or repository metadata. */
	private static readonly _IGNORED_DIRECTORY_NAMES = new Set([
		'.git',
		'.cache',
		'.turbo',
		'build',
		'dist',
		'node_modules',
		'target',
	]);

	/**
	 * Reads all current workspace subfolders as workspace-relative paths.
	 * @param gitWorkspace The resolved workspace folder.
	 * @returns Sorted paths using `/` separators, excluding generated and dependency folders.
	 */
	static read(gitWorkspace: GitWorkspace): string[] {
		const folders: string[] = [];
		const visit = (absoluteFolder: string, relativeFolder: string): void => {
			for (const entry of Fs.readdirSync(absoluteFolder, { withFileTypes: true })) {
				if (entry.isDirectory() === false || WorkspaceFolderReader._IGNORED_DIRECTORY_NAMES.has(entry.name)) {
					continue;
				}
				const childRelativeFolder = relativeFolder === ''
					? entry.name
					: `${relativeFolder}/${entry.name}`;
				folders.push(childRelativeFolder);
				visit(Path.join(absoluteFolder, entry.name), childRelativeFolder);
			}
		};
		visit(gitWorkspace.workspaceFolder, '');
		return folders.sort((firstFolder, secondFolder) => firstFolder.localeCompare(secondFolder));
	}
}
