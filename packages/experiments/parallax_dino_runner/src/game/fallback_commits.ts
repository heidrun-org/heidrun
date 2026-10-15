import type { CommitRecord } from './commit_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FallbackCommits — a short list of fake commits for a page that has no commits.json
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A fixed list of fake commits. The page plays with it when the file `commits.json` is missing, so the game always
 * plays. The tests use it too. It has every size of rock, a cactus, merge commits, and the three lanes.
 */
export class FallbackCommits {
	/**
	 * The fake commits: the subject, the lines added, the lines deleted, whether it is a merge, and the lane. The list
	 * goes from the oldest commit to the newest commit.
	 */
	private static readonly _ROWS: readonly (readonly [string, number, number, boolean, number])[] = [
		['Start the project', 12, 0, false, 1],
		['Add the first page', 40, 2, false, 1],
		['Add a title to the page', 3, 1, false, 1],
		['Start the branch of the menu', 18, 0, false, 2],
		['Add the menu', 120, 6, false, 2],
		['Fix a typo', 1, 1, false, 1],
		['Merge the branch of the menu', 138, 6, true, 1],
		['Rename the folder of the pages', 0, 0, false, 1],
		['Start the branch of the search', 9, 0, false, 0],
		['Add the search field', 64, 3, false, 0],
		['Add the style of the page', 210, 40, false, 1],
		['Add the results of the search', 77, 12, false, 0],
		['Remove an old file', 0, 340, false, 1],
		['Merge the branch of the search', 150, 15, true, 1],
		['Add the tests of the menu', 95, 0, false, 1],
		['Start the branch of the sound', 22, 0, false, 2],
		['Start the branch of the login', 15, 0, false, 0],
		['Add the sound of a click', 88, 4, false, 2],
		['Add the login form', 240, 10, false, 0],
		['Fix the color of the button', 2, 2, false, 1],
		['Add the sound of a error', 30, 0, false, 2],
		['Merge the branch of the sound', 118, 4, true, 1],
		['Add the check of the password', 520, 35, false, 0],
		['Merge the branch of the login', 790, 45, true, 1],
		['Update the documentation', 66, 20, false, 1],
		['Change the version', 1, 1, false, 1],
		['Replace the old database', 900, 640, false, 1],
		['Fix a bug of the search', 14, 6, false, 1],
		['Add the page of the settings', 180, 3, false, 1],
		['Remove the old tests', 0, 280, false, 1],
		['Start the branch of the chat', 40, 0, false, 2],
		['Add the list of the messages', 160, 12, false, 2],
		['Add the field of a new message', 75, 5, false, 2],
		['Merge the branch of the chat', 290, 17, true, 1],
		['Fix a crash at the start', 5, 3, false, 1],
		['Prepare the first release', 35, 8, false, 1],
	];

	/**
	 * Makes the list of fake commits. The dates are one day apart, from the first of January 2026.
	 * @returns The commits, from the oldest commit to the newest commit.
	 */
	static create(): CommitRecord[] {
		const commits = FallbackCommits._ROWS.map((row, index) => {
			const [subject, insertions, deletions, isMerge, lane] = row;
			const commit: CommitRecord = {
				hash: `fake${String(index + 1).padStart(36, '0')}`,
				committedAt: new Date(Date.UTC(2026, 0, 1 + index, 12)).toISOString(),
				subject,
				insertions,
				deletions,
				isMerge,
				lane,
			};
			return commit;
		});
		return commits;
	}
}
