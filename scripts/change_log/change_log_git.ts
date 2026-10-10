import ChildProcess from 'node:child_process';
import type { MergedPullRequest } from './change_log_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ChangeLogGit — reads the last release and the merged pull requests from the Git repository
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Runs `git` commands to find the last release and the pull requests that were merged after it.
 */
export class ChangeLogGit {
	/**
	 * Finds the root folder of the Git repository that holds a folder.
	 * @param workingDirectory A folder inside the Git repository.
	 * @returns The absolute path of the root folder of the Git repository.
	 * @throws An error when the folder is not inside a Git repository.
	 */
	static findRepositoryPath(workingDirectory: string): string {
		return ChangeLogGit._git(workingDirectory, ['rev-parse', '--show-toplevel']).trim();
	}

	/**
	 * Finds the last release: the tag with the highest version number among the tags that the current commit contains.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns The name of the tag, for example `v0.2.0`, or null when the repository has no such tag.
	 */
	static findLastTag(repositoryPath: string): string | null {
		const output = ChangeLogGit._git(repositoryPath, ['tag', '--merged', 'HEAD', '--sort=-v:refname']);
		const tags = output.split('\n').map((tag) => {
			return tag.trim();
		}).filter((tag) => {
			return tag !== '';
		});
		if (tags.length === 0) {
			return null;
		}
		return tags[0];
	}

	/**
	 * Lists the pull requests that were merged after a tag: the commits from the tag to the current commit whose
	 * subject starts with `Merge pull request #`.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param lastTag The tag to start after, or null to list all the history.
	 * @returns The merged pull requests, the newest first.
	 */
	static listMergedPullRequests(repositoryPath: string, lastTag: string | null): MergedPullRequest[] {
		const range = lastTag === null ? 'HEAD' : `${lastTag}..HEAD`;
		const output = ChangeLogGit._git(repositoryPath, [
			'log',
			range,
			'--grep=^Merge pull request #[0-9]',
			'--format=%s%x1f%b%x1e',
		]);
		const mergedPullRequests: MergedPullRequest[] = [];
		for (const record of output.split('\x1e')) {
			const [subject, body] = record.trim().split('\x1f');
			if (subject === undefined) {
				continue;
			}
			const match = /^Merge pull request #(\d+) from (\S+)/.exec(subject);
			if (match === null) {
				continue;
			}
			const trimmedBody = (body ?? '').trim();
			const firstBodyLine = trimmedBody.split('\n')[0].trim();
			mergedPullRequests.push({
				number: Number(match[1]),
				branchName: match[2],
				title: firstBodyLine === '' ? match[2] : firstBodyLine,
				message: trimmedBody === '' ? subject : `${subject}\n\n${trimmedBody}`,
			});
		}
		return mergedPullRequests;
	}

	/**
	 * Finds the web address of the GitHub repository, from the Git remote named `origin`.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns The address, for example `https://github.com/heidrun-org/heidrun`, or null when the remote is missing
	 * or is not a GitHub remote.
	 */
	static findRepositoryUrl(repositoryPath: string): string | null {
		let remoteUrl: string;
		try {
			remoteUrl = ChangeLogGit._git(repositoryPath, ['remote', 'get-url', 'origin']).trim();
		} catch {
			return null;
		}
		const match = /^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([^/]+)\/(.+?)(?:\.git)?\/?$/
			.exec(remoteUrl);
		if (match === null) {
			return null;
		}
		return `https://github.com/${match[1]}/${match[2]}`;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Runs one `git` command and returns its standard output.
	 * @param workingDirectory The folder to run the command in.
	 * @param args The arguments of the `git` command.
	 * @returns The standard output of the command.
	 * @throws An error when the command exits with an error code.
	 */
	private static _git(workingDirectory: string, args: string[]): string {
		return ChildProcess.execFileSync('git', args, {
			cwd: workingDirectory,
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
	}
}
