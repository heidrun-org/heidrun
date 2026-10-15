import type { CommitRecord } from '../index.ts';
import { CommitFileReader, FallbackCommits } from '../index.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CommitLoader — reads the file commits.json that sits next to the page
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The commits that the page plays with, and a notice for the player when they are not the real commits.
 */
export type LoadedCommits = {
	/** The commits, from the oldest commit to the newest commit. */
	commits: CommitRecord[];
	/** A short text that tells the player why the commits are fake, or null when the commits are real. */
	notice: string | null;
};

/**
 * Reads the file `commits.json` with a relative address, so the page works in any folder of a server of static files.
 * It makes no other request. When the file is missing or wrong, it gives the fake commits, so the game always plays.
 */
export class CommitLoader {
	/** The address of the file of commits, relative to the page. */
	private static readonly _FILE_ADDRESS = 'commits.json';

	/**
	 * Reads the file of commits.
	 * @returns The commits, and a notice when the commits are fake.
	 */
	static async load(): Promise<LoadedCommits> {
		try {
			const response = await fetch(CommitLoader._FILE_ADDRESS);
			if (response.ok === false) {
				throw new Error(`The server answered ${response.status}.`);
			}
			const commitFile = CommitFileReader.read(await response.json());
			const loadedCommits: LoadedCommits = {
				commits: commitFile.commits,
				notice: null,
			};
			return loadedCommits;
		} catch (error) {
			console.warn(`The page cannot read ${CommitLoader._FILE_ADDRESS}, so it plays with fake commits.`, error);
			const loadedCommits: LoadedCommits = {
				commits: FallbackCommits.create(),
				notice: 'Fake commits: the file commits.json is missing',
			};
			return loadedCommits;
		}
	}
}
