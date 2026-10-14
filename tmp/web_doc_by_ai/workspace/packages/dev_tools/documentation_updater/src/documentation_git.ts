import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import { DocumentationPaths } from './documentation_paths.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationGit — reads Git history for the documentation updater
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Reads Git history and records the last documented commit in a local file. Git commands never change the
 * branch, index, commits, or remote repository. The pull request ranges come from `ChangeLogGit` of the
 * package `change_log_generator`.
 */
export class DocumentationGit {
	/**
	 * Reads the last documented commit from the file `.last_documented_commit`.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns The full commit hash, or null when the file does not exist (the first run).
	 */
	static readLastDocumentedCommit(repositoryPath: string): string | null {
		const filePath = Path.join(repositoryPath, DocumentationPaths.lastDocumentedCommitFile);
		if (Fs.existsSync(filePath) === false) {
			return null;
		}
		const commit = Fs.readFileSync(filePath, 'utf8').trim();
		return commit === '' ? null : commit;
	}

	/**
	 * Writes the last documented commit in the file `.last_documented_commit`.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param commit The full commit hash.
	 * @returns Nothing.
	 */
	static writeLastDocumentedCommit(repositoryPath: string, commit: string): void {
		const filePath = Path.join(repositoryPath, DocumentationPaths.lastDocumentedCommitFile);
		Fs.mkdirSync(Path.dirname(filePath), { recursive: true });
		Fs.writeFileSync(filePath, `${commit}\n`);
	}

	/**
	 * Finds the full hash of the current commit.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns The full commit hash of `HEAD`.
	 */
	static findCurrentCommit(repositoryPath: string): string {
		return DocumentationGit._git(repositoryPath, ['rev-parse', 'HEAD']).trim();
	}

	/**
	 * Finds the name of the current branch.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns The name of the branch, or `HEAD` when no branch is checked out.
	 */
	static findCurrentBranch(repositoryPath: string): string {
		return DocumentationGit._git(repositoryPath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
	}

	/**
	 * Tests that a commit is an ancestor of another commit. A commit is an ancestor of itself.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param ancestor The commit that must be the older one.
	 * @param descendant The commit that must contain the ancestor.
	 * @returns True when `descendant` contains `ancestor`.
	 * @throws An error when `git` fails for another reason than the answer "no", for example an unknown commit.
	 */
	static isAncestor(repositoryPath: string, ancestor: string, descendant: string): boolean {
		const result = ChildProcess.spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
			cwd: repositoryPath,
			encoding: 'utf8',
		});
		if (result.status === 0) {
			return true;
		}
		if (result.status === 1) {
			return false;
		}
		throw new Error(`git merge-base failed: ${(result.stderr ?? '').trim()}`);
	}

	/**
	 * Finds the numbers of the issues that the commits of a range fix. A commit fixes an issue when its message has
	 * `fixes #12`, `closes #12`, or `resolves #12`, in any letter case.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param fromCommit The commit after which the range starts.
	 * @returns The issue numbers, without duplicates, from the lowest to the highest.
	 */
	static listFixedIssueNumbers(repositoryPath: string, fromCommit: string): number[] {
		const output = DocumentationGit._git(repositoryPath, ['log', `${fromCommit}..HEAD`, '--format=%B%x1e']);
		const numbers = new Set<number>();
		for (const match of output.matchAll(/\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi)) {
			numbers.add(Number(match[1]));
		}
		return [...numbers].sort((first, second) => {
			return first - second;
		});
	}

	/**
	 * Lists the files that changed in a range, inside some folders.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param fromCommit The commit after which the range starts.
	 * @param folders The folders to look in, relative to the root folder of the repository.
	 * @returns The changed files, relative to the root folder of the repository.
	 */
	static listChangedFiles(repositoryPath: string, fromCommit: string, folders: string[]): string[] {
		const output = DocumentationGit._git(repositoryPath, ['diff', '--name-only', `${fromCommit}..HEAD`, '--', ...folders]);
		return output.split('\n').map((line) => {
			return line.trim();
		}).filter((line) => {
			return line !== '';
		});
	}

	/**
	 * Reads the diff of a range, inside some folders.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param fromCommit The commit after which the range starts.
	 * @param folders The folders to look in, relative to the root folder of the repository.
	 * @returns The diff, as text.
	 */
	static readDiff(repositoryPath: string, fromCommit: string, folders: string[]): string {
		return DocumentationGit._git(repositoryPath, ['diff', `${fromCommit}..HEAD`, '--', ...folders]);
	}

	/**
	 * Tests that the working tree has no change, tracked or untracked.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns True when `git status --porcelain` prints nothing.
	 */
	static isWorkingTreeClean(repositoryPath: string): boolean {
		return DocumentationGit._git(repositoryPath, ['status', '--porcelain']).trim() === '';
	}

	/**
	 * Lists the changes of the working tree, one line for each file.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns The output of `git status --short`.
	 */
	static readShortStatus(repositoryPath: string): string {
		return DocumentationGit._git(repositoryPath, ['status', '--short']).trimEnd();
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
			maxBuffer: 256 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
	}
}
