import { afterAll, describe, expect, it } from 'vitest';
import { GitCommitReader } from '../src/commit_export/git_commit_reader.ts';
import { TestGitRepository } from './test_git_repository.ts';

describe('GitCommitReader', () => {
	afterAll(() => {
		TestGitRepository.removeAll();
	});

	const recordSeparator = '\u001e';
	const fieldSeparator = '\u001f';
	const makeHeader = (hash: string, parents: string, date: string, subject: string): string => {
		const fields = [hash, parents, date, subject];
		return `${recordSeparator}${fields.join(fieldSeparator)}`;
	};

	it('turns the output of the command git log into commits', () => {
		const output = [
			makeHeader('aaa', 'bbb ccc', '2026-03-01T12:00:00+02:00', 'Merge it'),
			'',
			'4\t1\tsrc/a.ts',
			'-\t-\timage.png',
			'0\t7\tsrc/b.ts',
			makeHeader('bbb', '', '2026-03-01T09:00:00Z', 'The first commit'),
			'',
			'3\t0\ta.txt',
			'',
		].join('\n');
		const rawCommits = GitCommitReader.parse(output);
		expect(rawCommits).toEqual([
			{
				hash: 'aaa',
				parents: ['bbb', 'ccc'],
				committedAt: '2026-03-01T10:00:00.000Z',
				subject: 'Merge it',
				insertions: 4,
				deletions: 8,
			},
			{
				hash: 'bbb',
				parents: [],
				committedAt: '2026-03-01T09:00:00.000Z',
				subject: 'The first commit',
				insertions: 3,
				deletions: 0,
			},
		]);
	});

	it('gives a commit with no changed line the counts 0', () => {
		const output = `${makeHeader('aaa', '', '2026-03-01T09:00:00Z', 'Empty')}\n`;
		const [rawCommit] = GitCommitReader.parse(output);
		expect(rawCommit.insertions).toBe(0);
		expect(rawCommit.deletions).toBe(0);
	});

	it('reads the commits of a real repository, merge commits and binary files included', () => {
		const folder = TestGitRepository.createWithFeatureBranch();
		const rawCommits = GitCommitReader.read(folder);
		expect(rawCommits).toHaveLength(6);
		const bySubject = new Map(rawCommits.map((rawCommit) => [rawCommit.subject, rawCommit]));
		expect(bySubject.get('Start')).toMatchObject({ parents: [], insertions: 3, deletions: 0 });
		expect(bySubject.get('Start')?.committedAt).toBe('2026-03-01T10:00:00.000Z');
		expect(bySubject.get('Start the feature')).toMatchObject({ insertions: 5, deletions: 0 });
		expect(bySubject.get('Finish the feature')).toMatchObject({ insertions: 2, deletions: 0 });
		expect(bySubject.get('Change the start')).toMatchObject({ insertions: 1, deletions: 0 });
		expect(bySubject.get('Add a binary file')).toMatchObject({ insertions: 0, deletions: 0 });
		const mergeCommit = bySubject.get('Merge the feature');
		expect(mergeCommit?.parents).toHaveLength(2);
		expect(mergeCommit?.parents[0]).toBe(bySubject.get('Change the start')?.hash);
		expect(mergeCommit?.parents[1]).toBe(bySubject.get('Finish the feature')?.hash);
		expect(mergeCommit).toMatchObject({ insertions: 7, deletions: 0 });
	});

	it('reads no commit from a repository that has no commit', () => {
		expect(GitCommitReader.read(TestGitRepository.createEmpty())).toEqual([]);
	});

	it('refuses a folder that is not a Git repository', () => {
		expect(() => GitCommitReader.read(TestGitRepository.createNotGit())).toThrow('Cannot read the Git history');
	});
});
