import ChildProcess from 'node:child_process';
import type { RawCommit } from './commit_export_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GitCommitReader — the only code that runs the command git
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Reads every commit of a Git folder with the command `git log`: the commits that the local branches, the remote
 * branches, and the tags reach, merge commits included. The command only reads, so it never changes the folder.
 */
export class GitCommitReader {
	/** The character that starts each commit in the output of the command `git log`. */
	private static readonly _RECORD_SEPARATOR = '\u001e';

	/** The character that separates the fields of the first line of a commit in the output of the command. */
	private static readonly _FIELD_SEPARATOR = '\u001f';

	/** The largest output that the command may write, in bytes. */
	private static readonly _MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;

	/**
	 * Reads the commits of a Git folder.
	 * @param gitFolder The folder of a Git repository, or a folder inside it.
	 * @returns The commits, in the order of the command, which is not the order of the game.
	 * @throws An error when the folder is not a Git repository, or when the command fails.
	 */
	static read(gitFolder: string): RawCommit[] {
		const gitArguments = ['-C', gitFolder, 'log', '--branches', '--remotes', '--tags'];
		gitArguments.push('--no-renames', '--diff-merges=first-parent', '--numstat');
		gitArguments.push('--format=%x1e%H%x1f%P%x1f%cI%x1f%s');
		let output: string;
		try {
			output = ChildProcess.execFileSync('git', gitArguments, {
				encoding: 'utf8',
				maxBuffer: GitCommitReader._MAX_OUTPUT_BYTES,
				stdio: ['ignore', 'pipe', 'pipe'],
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Cannot read the Git history of ${gitFolder}: ${message}`);
		}
		const rawCommits = GitCommitReader.parse(output);
		return rawCommits;
	}

	/**
	 * Turns the output of the command `git log` into commits.
	 * @param output The output of the command, in the format of {@link GitCommitReader.read}.
	 * @returns The commits, in the order of the output.
	 */
	static parse(output: string): RawCommit[] {
		const rawCommits: RawCommit[] = [];
		for (const record of output.split(GitCommitReader._RECORD_SEPARATOR)) {
			if (record.trim() === '') {
				continue;
			}
			const lines = record.split('\n');
			const [hash, parentsText, dateText, subject] = lines[0].split(GitCommitReader._FIELD_SEPARATOR);
			let insertions = 0;
			let deletions = 0;
			for (const line of lines.slice(1)) {
				const match = /^(\d+|-)\t(\d+|-)\t/.exec(line);
				if (match !== null) {
					insertions += match[1] === '-' ? 0 : Number(match[1]);
					deletions += match[2] === '-' ? 0 : Number(match[2]);
				}
			}
			const rawCommit: RawCommit = {
				hash,
				parents: parentsText === '' ? [] : parentsText.split(' '),
				committedAt: new Date(dateText).toISOString(),
				subject,
				insertions,
				deletions,
			};
			rawCommits.push(rawCommit);
		}
		return rawCommits;
	}
}
