import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TemporaryFolder — creates folders for the tests, and removes them when the test ends
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Makes temporary folders for the tests. Only the tests import this class.
 */
export class TemporaryFolder {
	/** The absolute paths of the folders that this class created and did not remove yet. */
	private static readonly createdPaths: string[] = [];

	/**
	 * Creates an empty temporary folder.
	 * @returns The absolute path of the new folder.
	 */
	static create(): string {
		const folderPath = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'data_layer_boundary_checker_'));
		TemporaryFolder.createdPaths.push(folderPath);
		return folderPath;
	}

	/**
	 * Removes every folder that this class created.
	 */
	static removeAll(): void {
		for (const folderPath of TemporaryFolder.createdPaths.splice(0)) {
			Fs.rmSync(folderPath, { recursive: true, force: true });
		}
	}
}
