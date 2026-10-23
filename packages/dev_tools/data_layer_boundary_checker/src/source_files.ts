import Fs from 'node:fs';
import Path from 'node:path';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SourceFiles — lists the source files of a folder
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Lists the files of a folder of the repository.
 */
export class SourceFiles {
	/**
	 * Lists the files of a folder and of all its subfolders that have one of the given extensions.
	 *
	 * @param repositoryPath - The path of the root of the repository.
	 * @param folderPath - The folder to list, relative to the root of the repository.
	 * @param extensions - The extensions to keep, each with its dot, for example `.rs`.
	 * @returns The paths of the files relative to the root of the repository, with `/` as separator, in alphabetical order.
	 */
	static list(repositoryPath: string, folderPath: string, extensions: string[]): string[] {
		const absoluteFolderPath = Path.join(repositoryPath, folderPath);
		if (Fs.existsSync(absoluteFolderPath) === false) {
			return [];
		}
		const filePaths: string[] = [];
		SourceFiles._collect(repositoryPath, absoluteFolderPath, extensions, filePaths);
		return filePaths.sort();
	}

	/**
	 * Reads a text file of the repository.
	 *
	 * @param repositoryPath - The path of the root of the repository.
	 * @param filePath - The path of the file relative to the root of the repository.
	 * @returns The text of the file.
	 */
	static read(repositoryPath: string, filePath: string): string {
		return Fs.readFileSync(Path.join(repositoryPath, filePath), 'utf8');
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Adds the files of a folder and of its subfolders to a list.
	 *
	 * @param repositoryPath - The path of the root of the repository.
	 * @param absoluteFolderPath - The absolute path of the folder to read.
	 * @param extensions - The extensions to keep, each with its dot.
	 * @param filePaths - The list to fill, changed in place.
	 */
	private static _collect(
		repositoryPath: string,
		absoluteFolderPath: string,
		extensions: string[],
		filePaths: string[],
	): void {
		for (const entry of Fs.readdirSync(absoluteFolderPath, { withFileTypes: true })) {
			const absoluteEntryPath = Path.join(absoluteFolderPath, entry.name);
			if (entry.isDirectory() === true) {
				if (entry.name !== 'node_modules' && entry.name !== 'target') {
					SourceFiles._collect(repositoryPath, absoluteEntryPath, extensions, filePaths);
				}
				continue;
			}
			if (extensions.includes(Path.extname(entry.name)) === true) {
				filePaths.push(Path.relative(repositoryPath, absoluteEntryPath).split(Path.sep).join('/'));
			}
		}
	}
}
