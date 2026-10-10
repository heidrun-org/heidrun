import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TestRepository — creates a small Git repository in a temporary folder, for the tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Creates and fills temporary Git repositories. A test uses them in place of the real repository.
 */
export class TestRepository {
	/** The folders that the class created and did not remove yet. */
	private static _createdPaths: string[] = [];

	/**
	 * Creates an empty Git repository, with a remote named `origin`.
	 * @param remoteUrl The address of the remote `origin`.
	 * @returns The absolute path of the new folder.
	 */
	static create(remoteUrl: string = 'git@github.com:acme/widgets.git'): string {
		const repositoryPath = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'change_log_test_'));
		TestRepository.git(repositoryPath, ['init', '--quiet']);
		TestRepository.git(repositoryPath, ['config', 'user.name', 'Test Author']);
		TestRepository.git(repositoryPath, ['config', 'user.email', 'test@example.com']);
		TestRepository.git(repositoryPath, ['config', 'commit.gpgsign', 'false']);
		TestRepository.git(repositoryPath, ['remote', 'add', 'origin', remoteUrl]);
		TestRepository._createdPaths.push(repositoryPath);
		return repositoryPath;
	}

	/**
	 * Creates a repository with this history: the release `v1.0.0` that holds the pull request 3, then the pull
	 * requests 7 and 8 with an ordinary commit between them.
	 * @returns The absolute path of the new folder.
	 */
	static createWithRelease(): string {
		const repositoryPath = TestRepository.create();
		TestRepository.commit(repositoryPath, 'Merge pull request #3 from acme/old-work', 'Do the old work');
		TestRepository.git(repositoryPath, ['tag', 'v1.0.0']);
		TestRepository.commit(repositoryPath, 'Merge pull request #7 from acme/add-thing', 'Add the thing');
		TestRepository.commit(repositoryPath, 'Fix a typo');
		TestRepository.commit(repositoryPath, 'Merge pull request #8 from acme/fix-bug', 'Fix the bug');
		return repositoryPath;
	}

	/**
	 * Adds one empty commit.
	 * @param repositoryPath The folder of the repository.
	 * @param subject The first line of the commit message.
	 * @param body The body of the commit message, or undefined for none.
	 * @returns Nothing.
	 */
	static commit(repositoryPath: string, subject: string, body?: string): void {
		const messageArgs = body === undefined ? ['-m', subject] : ['-m', subject, '-m', body];
		TestRepository.git(repositoryPath, ['commit', '--quiet', '--allow-empty', ...messageArgs]);
	}

	/**
	 * Runs one `git` command in a repository.
	 * @param repositoryPath The folder to run the command in.
	 * @param args The arguments of the `git` command.
	 * @returns The standard output of the command.
	 */
	static git(repositoryPath: string, args: string[]): string {
		return ChildProcess.execFileSync('git', args, {
			cwd: repositoryPath,
			encoding: 'utf8',
		});
	}

	/**
	 * Removes all the repository folders that the class created.
	 * @returns Nothing.
	 */
	static removeAll(): void {
		for (const repositoryPath of TestRepository._createdPaths.splice(0)) {
			Fs.rmSync(repositoryPath, { recursive: true, force: true });
		}
	}
}
