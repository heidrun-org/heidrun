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
	 * Creates an empty Git repository.
	 * @returns The absolute path of the new folder.
	 */
	static create(): string {
		const repositoryPath = Fs.realpathSync(Fs.mkdtempSync(Path.join(Os.tmpdir(), 'documentation_updater_test_')));
		TestRepository.git(repositoryPath, ['init', '--quiet', '--initial-branch=main']);
		TestRepository.git(repositoryPath, ['config', 'user.name', 'Test Author']);
		TestRepository.git(repositoryPath, ['config', 'user.email', 'test@example.com']);
		TestRepository.git(repositoryPath, ['config', 'commit.gpgsign', 'false']);
		TestRepository._createdPaths.push(repositoryPath);
		return repositoryPath;
	}

	/**
	 * Writes a file, with its folders, and makes a commit.
	 * @param repositoryPath The folder of the repository.
	 * @param filePath The path of the file, relative to the repository.
	 * @param text The text of the file.
	 * @param subject The first line of the commit message.
	 * @param body The body of the commit message, or undefined for none.
	 * @returns The full hash of the new commit.
	 */
	static commitFile(repositoryPath: string, filePath: string, text: string, subject: string, body?: string): string {
		const absolutePath = Path.join(repositoryPath, filePath);
		Fs.mkdirSync(Path.dirname(absolutePath), { recursive: true });
		Fs.writeFileSync(absolutePath, text);
		TestRepository.git(repositoryPath, ['add', '--all']);
		const messageArgs = body === undefined ? ['-m', subject] : ['-m', subject, '-m', body];
		TestRepository.git(repositoryPath, ['commit', '--quiet', ...messageArgs]);
		return TestRepository.git(repositoryPath, ['rev-parse', 'HEAD']).trim();
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
