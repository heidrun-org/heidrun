import Fs from 'node:fs';
import Path from 'node:path';
import { TemporaryFolder } from './temporary_folder.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	RepositoryCopy — copies the checked files of the repository, and changes the copy to add a bypass
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A copy of the files that the checker reads: the Rust files and the manifest of the desktop application, and the web page
 * files. A test adds a bypass to the copy, runs the checker, then restores the copy. Only the tests import this class.
 */
export class RepositoryCopy {
	/** The absolute path of the folder that holds the copy. */
	readonly copyPath: string;

	/** The text that each changed file had before the change, or null for a file that the test created. */
	private readonly originals = new Map<string, string | null>();

	/**
	 * Copies the files that the checker reads.
	 *
	 * @param repositoryPath - The absolute path of the root of the repository to copy.
	 */
	constructor(repositoryPath: string) {
		this.copyPath = TemporaryFolder.create();
		const folders = ['packages/apps/desktop_tauri/src', 'packages/apps/web_frontend/src'];
		for (const folder of folders) {
			Fs.cpSync(Path.join(repositoryPath, folder), Path.join(this.copyPath, folder), {
				recursive: true,
				filter: (sourcePath) => RepositoryCopy._isChecked(sourcePath),
			});
		}
		const manifestPath = 'packages/apps/desktop_tauri/Cargo.toml';
		Fs.copyFileSync(Path.join(repositoryPath, manifestPath), Path.join(this.copyPath, manifestPath));
	}

	/**
	 * Adds text at the end of a file of the copy, or creates the file.
	 *
	 * @param relativePath - The path of the file relative to the root of the copy.
	 * @param addedText - The text to add.
	 */
	append(relativePath: string, addedText: string): void {
		const absolutePath = Path.join(this.copyPath, relativePath);
		this._remember(relativePath);
		const current = Fs.existsSync(absolutePath) === true ? Fs.readFileSync(absolutePath, 'utf8') : '';
		Fs.mkdirSync(Path.dirname(absolutePath), { recursive: true });
		Fs.writeFileSync(absolutePath, `${current}\n${addedText}\n`);
	}

	/**
	 * Puts every changed file of the copy back to its first text, and removes the files that a test created.
	 */
	restore(): void {
		for (const [relativePath, original] of this.originals) {
			const absolutePath = Path.join(this.copyPath, relativePath);
			if (original === null) {
				Fs.rmSync(absolutePath, { force: true });
			} else {
				Fs.writeFileSync(absolutePath, original);
			}
		}
		this.originals.clear();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Keeps the first text of a file, once.
	 *
	 * @param relativePath - The path of the file relative to the root of the copy.
	 */
	private _remember(relativePath: string): void {
		if (this.originals.has(relativePath) === true) {
			return;
		}
		const absolutePath = Path.join(this.copyPath, relativePath);
		if (Fs.existsSync(absolutePath) === true) {
			this.originals.set(relativePath, Fs.readFileSync(absolutePath, 'utf8'));
		} else {
			this.originals.set(relativePath, null);
		}
	}

	/**
	 * Tells whether a path is a folder, or a source file that the checker reads.
	 *
	 * @param sourcePath - The absolute path in the repository.
	 * @returns True for a folder that is not node_modules, and for a Rust, TypeScript, or Vue file that is not a test file.
	 */
	private static _isChecked(sourcePath: string): boolean {
		const stat = Fs.statSync(sourcePath);
		if (stat.isDirectory() === true) {
			return Path.basename(sourcePath) !== 'node_modules';
		}
		if (sourcePath.includes('.test.') === true) {
			return false;
		}
		return ['.rs', '.ts', '.vue'].includes(Path.extname(sourcePath));
	}
}
