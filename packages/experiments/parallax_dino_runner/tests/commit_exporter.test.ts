import Fs from 'node:fs';
import Path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Cli } from '../src/commit_export/cli.ts';
import { CommitExporter } from '../src/commit_export/commit_exporter.ts';
import { CommitFileReader } from '../src/index.ts';
import { TestGitRepository } from './test_git_repository.ts';

describe('CommitExporter', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		process.exitCode = undefined;
	});

	afterAll(() => {
		TestGitRepository.removeAll();
	});

	const makeOutputPath = (): string => {
		return Path.join(TestGitRepository.createTemporaryFolder(), 'deep', 'commits.json');
	};

	it('writes a file that the page accepts, with one commit on each line', () => {
		const outputPath = makeOutputPath();
		const commitFile = CommitExporter.export(TestGitRepository.createWithFeatureBranch(), outputPath);
		const text = Fs.readFileSync(outputPath, 'utf8');
		expect(CommitFileReader.read(JSON.parse(text))).toEqual(commitFile);
		expect(text.split('\n')).toHaveLength(commitFile.commits.length + 3);
	});

	it('orders the commits with the parents first, and gives the lanes', () => {
		const outputPath = makeOutputPath();
		const commitFile = CommitExporter.export(TestGitRepository.createWithFeatureBranch(), outputPath);
		const subjects = commitFile.commits.map((commit) => commit.subject);
		expect(subjects).toEqual([
			'Start',
			'Start the feature',
			'Finish the feature',
			'Change the start',
			'Merge the feature',
			'Add a binary file',
		]);
		const laneBySubject = new Map(commitFile.commits.map((commit) => [commit.subject, commit.lane]));
		expect(laneBySubject.get('Start')).toBe(1);
		expect(laneBySubject.get('Change the start')).toBe(1);
		expect(laneBySubject.get('Merge the feature')).toBe(1);
		expect(laneBySubject.get('Add a binary file')).toBe(1);
		expect(laneBySubject.get('Start the feature')).toBe(0);
		expect(laneBySubject.get('Finish the feature')).toBe(0);
		expect(commitFile.commits.filter((commit) => commit.isMerge)).toHaveLength(1);
	});

	it('refuses a repository with no commit, and writes no file', () => {
		const outputPath = makeOutputPath();
		expect(() => CommitExporter.export(TestGitRepository.createEmpty(), outputPath)).toThrow('has no commit');
		expect(Fs.existsSync(outputPath)).toBe(false);
	});

	it('writes the file from the command line', () => {
		const outputPath = makeOutputPath();
		const writeMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
		Cli.main(['node', 'cli', '--git-folder', TestGitRepository.createWithFeatureBranch(), '--output', outputPath]);
		expect(Fs.existsSync(outputPath)).toBe(true);
		expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('Wrote 6 commits'));
		expect(process.exitCode).toBeUndefined();
	});

	it('prints the error and sets the exit code 1 when the folder is not a Git repository', () => {
		const writeMock = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
		Cli.main(['node', 'cli', '--git-folder', TestGitRepository.createNotGit(), '--output', makeOutputPath()]);
		expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('Cannot read the Git history'));
		expect(process.exitCode).toBe(1);
	});
});
