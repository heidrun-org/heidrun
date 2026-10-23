import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TestGitRepository — makes a small real Git repository in a temporary folder for the tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Makes a small real Git repository in a temporary folder. The author and the dates are fixed, and the configuration
 * files of the developer are not read, so every run gives the same history. Only the tests import this class.
 */
export class TestGitRepository {
	/** The temporary folders that this class made, so that {@link TestGitRepository.removeAll} can delete them. */
	private static readonly _folders: string[] = [];

	/**
	 * Makes an empty temporary folder. {@link TestGitRepository.removeAll} deletes it.
	 * @returns The folder.
	 */
	static createTemporaryFolder(): string {
		const folder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'parallax_dino_runner_test_'));
		TestGitRepository._folders.push(folder);
		return folder;
	}

	/**
	 * Deletes every temporary folder that this class made. A test calls it when the test file ends.
	 */
	static removeAll(): void {
		for (const folder of TestGitRepository._folders.splice(0)) {
			Fs.rmSync(folder, { recursive: true, force: true });
		}
	}

	/**
	 * Makes a repository with this history, from the oldest commit to the newest commit:
	 * "Start" (3 lines), "Start the feature" (5 lines), "Finish the feature" (2 lines), "Change the start" (1 line),
	 * "Merge the feature" (a merge commit that brings the 7 lines of the feature), and "Add a binary file".
	 * @returns The folder of the repository.
	 */
	static createWithFeatureBranch(): string {
		const folder = TestGitRepository.createEmpty();
		const feature1 = '1\n2\n3\n4\n5\n';
		const feature2 = '1\n2\n3\n4\n5\n6\n7\n';
		TestGitRepository.commit(folder, 'Start', { 'a.txt': 'one\ntwo\nthree\n' }, '2026-03-01T12:00:00+0200');
		TestGitRepository.run(folder, ['switch', '-q', '-c', 'feature']);
		TestGitRepository.commit(folder, 'Start the feature', { 'b.txt': feature1 }, '2026-03-02T10:00:00+0000');
		TestGitRepository.commit(folder, 'Finish the feature', { 'b.txt': feature2 }, '2026-03-03T10:00:00+0000');
		TestGitRepository.run(folder, ['switch', '-q', 'main']);
		const changedStart = { 'a.txt': 'one\ntwo\nthree\nfour\n' };
		TestGitRepository.commit(folder, 'Change the start', changedStart, '2026-03-04T10:00:00+0000');
		const mergeArguments = ['merge', '-q', '--no-ff', '-m', 'Merge the feature', 'feature'];
		TestGitRepository.run(folder, mergeArguments, '2026-03-05T10:00:00+0000');
		const binaryFile = { 'blob.bin': Buffer.from([0, 1, 2, 0, 255]) };
		TestGitRepository.commit(folder, 'Add a binary file', binaryFile, '2026-03-06T10:00:00+0000');
		return folder;
	}

	/**
	 * Makes a repository with no commit.
	 * @returns The folder of the repository.
	 */
	static createEmpty(): string {
		const folder = TestGitRepository.createTemporaryFolder();
		TestGitRepository.run(folder, ['init', '-q', '-b', 'main']);
		return folder;
	}

	/**
	 * Makes a folder that is not a Git repository.
	 * @returns The folder.
	 */
	static createNotGit(): string {
		const folder = TestGitRepository.createTemporaryFolder();
		return folder;
	}

	/**
	 * Writes files and makes a commit.
	 * @param folder The folder of the repository.
	 * @param message The message of the commit.
	 * @param files The content of each file to write, by the name of the file.
	 * @param isoDate The date of the commit, in the ISO format with the time zone.
	 */
	static commit(folder: string, message: string, files: Record<string, string | Buffer>, isoDate: string): void {
		for (const [fileName, content] of Object.entries(files)) {
			Fs.writeFileSync(Path.join(folder, fileName), content);
		}
		TestGitRepository.run(folder, ['add', '-A']);
		TestGitRepository.run(folder, ['commit', '-q', '-m', message], isoDate);
	}

	/**
	 * Runs one command of Git in the repository.
	 * @param folder The folder of the repository.
	 * @param gitArguments The arguments of the command.
	 * @param isoDate The date for the author and for the committer, or undefined for the current date.
	 * @returns The output of the command.
	 */
	static run(folder: string, gitArguments: string[], isoDate?: string): string {
		const environment: NodeJS.ProcessEnv = {
			...process.env,
			GIT_CONFIG_GLOBAL: '/dev/null',
			GIT_CONFIG_SYSTEM: '/dev/null',
			GIT_AUTHOR_NAME: 'Test Author',
			GIT_AUTHOR_EMAIL: 'author@example.com',
			GIT_COMMITTER_NAME: 'Test Author',
			GIT_COMMITTER_EMAIL: 'author@example.com',
		};
		if (isoDate !== undefined) {
			environment.GIT_AUTHOR_DATE = isoDate;
			environment.GIT_COMMITTER_DATE = isoDate;
		}
		const output = ChildProcess.execFileSync('git', ['-C', folder, ...gitArguments], {
			encoding: 'utf8',
			env: environment,
		});
		return output;
	}
}
