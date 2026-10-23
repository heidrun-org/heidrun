import Fs from 'node:fs';
import Path from 'node:path';
import type { CommitFile } from '../index.ts';
import { GitCommitReader } from './git_commit_reader.ts';
import { LaneAssigner } from './lane_assigner.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CommitExporter — writes the file commits.json from the history of a Git folder
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Writes the file `commits.json` that the page of the game reads: the commits of a Git folder, in the order of the
 * game, each with its lane.
 */
export class CommitExporter {
	/**
	 * Reads the history of a Git folder, and writes the file of commits.
	 * @param gitFolder The folder of a Git repository, or a folder inside it.
	 * @param outputPath The path of the JSON file to write. The folders on the way are made when they do not exist.
	 * @returns The file of commits that was written.
	 * @throws An error when the folder is not a Git repository, or when the repository has no commit.
	 */
	static export(gitFolder: string, outputPath: string): CommitFile {
		const rawCommits = GitCommitReader.read(gitFolder);
		if (rawCommits.length === 0) {
			throw new Error(`The Git history of ${gitFolder} has no commit.`);
		}
		const commitFile: CommitFile = {
			commits: LaneAssigner.assign(rawCommits),
		};
		Fs.mkdirSync(Path.dirname(outputPath), { recursive: true });
		Fs.writeFileSync(outputPath, CommitExporter.format(commitFile));
		return commitFile;
	}

	/**
	 * Writes a file of commits as JSON text, with one commit on each line, so that a person can read the file.
	 * @param commitFile The file of commits.
	 * @returns The JSON text.
	 */
	static format(commitFile: CommitFile): string {
		const commitLines = commitFile.commits.map((commit) => JSON.stringify(commit));
		const jsonText = `{"commits":[\n${commitLines.join(',\n')}\n]}\n`;
		return jsonText;
	}
}
