import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import type { GitCommitActivity, GitFileChange, GitWorkspace } from './folder_activity_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GitActivityReader — reads Git commits and per-file line changes
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Reads commit dates and per-file line changes from the Git repository of a workspace folder. */
export class GitActivityReader {
	/** The record separator at the start of each commit in the command output. */
	private static readonly _RECORD_SEPARATOR = '\u001e';

	/** The field separator between the commit hash and committer date. */
	private static readonly _FIELD_SEPARATOR = '\u001f';

	/** The largest output that the Git history command may write, in bytes. */
	private static readonly _MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;

	/**
	 * Resolves the repository and selected workspace folder.
	 * @param workspaceFolder The caller's workspace folder path.
	 * @returns The resolved repository and workspace paths.
	 */
	static resolveWorkspace(workspaceFolder: string): GitWorkspace {
		let resolvedWorkspaceFolder: string;
		try {
			resolvedWorkspaceFolder = Fs.realpathSync(workspaceFolder);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Cannot read workspace folder ${workspaceFolder}: ${message}`);
		}
		if (Fs.statSync(resolvedWorkspaceFolder).isDirectory() === false) {
			throw new Error(`Workspace folder is not a folder: ${workspaceFolder}`);
		}
		let repositoryFolder: string;
		try {
			repositoryFolder = ChildProcess.execFileSync(
				'git',
				['-C', resolvedWorkspaceFolder, 'rev-parse', '--show-toplevel'],
				{
					encoding: 'utf8',
					stdio: ['ignore', 'pipe', 'pipe'],
				},
			).trim();
			repositoryFolder = Fs.realpathSync(repositoryFolder);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Workspace folder is not inside a Git repository: ${resolvedWorkspaceFolder}: ${message}`);
		}
		const workspaceRelativePath = Path.relative(repositoryFolder, resolvedWorkspaceFolder)
			.split(Path.sep)
			.join('/');
		if (workspaceRelativePath === '..' || workspaceRelativePath.startsWith('../')) {
			throw new Error(`Workspace folder is outside its Git repository: ${resolvedWorkspaceFolder}`);
		}
		return {
			repositoryFolder,
			workspaceFolder: resolvedWorkspaceFolder,
			workspaceRelativePath,
		};
	}

	/**
	 * Reads commit history and per-file line changes from a Git workspace.
	 * @param gitWorkspace The resolved repository and workspace paths.
	 * @returns Commits reachable from local branches, remote branches, and tags.
	 * @throws An error when Git cannot read the repository history.
	 */
	static read(gitWorkspace: GitWorkspace): GitCommitActivity[] {
		const gitArguments = [
			'-C', gitWorkspace.repositoryFolder,
			'log', '--all', '--no-renames', '--diff-merges=first-parent', '--numstat', '-z',
			'--format=%x1e%H%x1f%cI',
		];
		let output: string;
		try {
			output = ChildProcess.execFileSync('git', gitArguments, {
				encoding: 'utf8',
				maxBuffer: GitActivityReader._MAX_OUTPUT_BYTES,
				stdio: ['ignore', 'pipe', 'pipe'],
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Cannot read the Git history of ${gitWorkspace.repositoryFolder}: ${message}`);
		}
		return GitActivityReader._parse(output);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Parses the `git log --numstat -z` output.
	 * @param output The command output, with a record separator before each commit.
	 * @returns Parsed commits and their per-file line changes.
	 */
	private static _parse(output: string): GitCommitActivity[] {
		const commits: GitCommitActivity[] = [];
		for (const record of output.split(GitActivityReader._RECORD_SEPARATOR)) {
			if (record.trim() === '') {
				continue;
			}
			const newlineIndex = record.indexOf('\n');
			if (newlineIndex < 0) {
				continue;
			}
			const header = record.slice(0, newlineIndex);
			const [hash, committedAtText] = header.split(GitActivityReader._FIELD_SEPARATOR);
			const committedAtDate = new Date(committedAtText);
			if (Number.isNaN(committedAtDate.getTime()) === true) {
				throw new Error(`Git returned an invalid committer date for commit ${hash}.`);
			}
			const fileChanges = GitActivityReader._parseFileChanges(record.slice(newlineIndex + 1));
			commits.push({
				hash,
				committedAt: committedAtDate.toISOString(),
				fileChanges,
			});
		}
		return commits;
	}

	/**
	 * Parses the NUL-separated numstat records for a commit.
	 * @param numstatText The numstat records after the commit header.
	 * @returns The per-file line changes of the commit.
	 */
	private static _parseFileChanges(numstatText: string): GitFileChange[] {
		const fileChanges: GitFileChange[] = [];
		for (const entry of numstatText.split('\u0000')) {
			const match = /^(?:\n)?(-|\d+)\t(-|\d+)\t([\s\S]*)$/.exec(entry);
			if (match === null) {
				continue;
			}
			fileChanges.push({
				addedLines: match[1] === '-' ? 0 : Number(match[1]),
				deletedLines: match[2] === '-' ? 0 : Number(match[2]),
				filePath: match[3],
			});
		}
		return fileChanges;
	}
}
