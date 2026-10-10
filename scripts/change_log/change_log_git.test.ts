import { afterEach, describe, expect, it } from 'vitest';
import { ChangeLogGit } from './change_log_git.ts';
import { TestRepository } from './test_repository.ts';

describe('ChangeLogGit', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	describe('findLastTag', () => {
		it('returns the tag with the highest version number', () => {
			const repositoryPath = TestRepository.createWithRelease();
			TestRepository.git(repositoryPath, ['tag', 'v0.9.0']);
			TestRepository.git(repositoryPath, ['tag', 'v1.10.0']);
			TestRepository.git(repositoryPath, ['tag', 'v1.9.0']);
			expect(ChangeLogGit.findLastTag(repositoryPath)).toBe('v1.10.0');
		});

		it('returns null when the repository has no tag', () => {
			const repositoryPath = TestRepository.create();
			TestRepository.commit(repositoryPath, 'Initial commit');
			expect(ChangeLogGit.findLastTag(repositoryPath)).toBeNull();
		});
	});

	describe('listMergedPullRequests', () => {
		it('lists the pull requests merged after the tag, the newest first, and skips the ordinary commits', () => {
			const repositoryPath = TestRepository.createWithRelease();
			expect(ChangeLogGit.listMergedPullRequests(repositoryPath, 'v1.0.0')).toEqual([
				{
					number: 8,
					branchName: 'acme/fix-bug',
					title: 'Fix the bug',
					message: 'Merge pull request #8 from acme/fix-bug\n\nFix the bug',
				},
				{
					number: 7,
					branchName: 'acme/add-thing',
					title: 'Add the thing',
					message: 'Merge pull request #7 from acme/add-thing\n\nAdd the thing',
				},
			]);
		});

		it('lists all the history when the tag is null', () => {
			const repositoryPath = TestRepository.createWithRelease();
			const numbers = ChangeLogGit.listMergedPullRequests(repositoryPath, null).map((mergedPullRequest) => {
				return mergedPullRequest.number;
			});
			expect(numbers).toEqual([8, 7, 3]);
		});

		it('uses the name of the branch as the title when the merge commit has no body', () => {
			const repositoryPath = TestRepository.createWithRelease();
			TestRepository.commit(repositoryPath, 'Merge pull request #9 from acme/no-body');
			const [newest] = ChangeLogGit.listMergedPullRequests(repositoryPath, 'v1.0.0');
			expect(newest.title).toBe('acme/no-body');
			expect(newest.message).toBe('Merge pull request #9 from acme/no-body');
		});

		it('returns an empty list when nothing was merged after the tag', () => {
			const repositoryPath = TestRepository.create();
			TestRepository.commit(repositoryPath, 'Merge pull request #3 from acme/old-work', 'Do the old work');
			TestRepository.git(repositoryPath, ['tag', 'v1.0.0']);
			expect(ChangeLogGit.listMergedPullRequests(repositoryPath, 'v1.0.0')).toEqual([]);
		});
	});

	describe('findRepositoryUrl', () => {
		it.each([
			['git@github.com:acme/widgets.git', 'https://github.com/acme/widgets'],
			['https://github.com/acme/widgets.git', 'https://github.com/acme/widgets'],
			['https://github.com/acme/widgets', 'https://github.com/acme/widgets'],
			['ssh://git@github.com/acme/widgets.git', 'https://github.com/acme/widgets'],
		])('turns the remote %s into %s', (remoteUrl, expectedUrl) => {
			const repositoryPath = TestRepository.create(remoteUrl);
			expect(ChangeLogGit.findRepositoryUrl(repositoryPath)).toBe(expectedUrl);
		});

		it('returns null for a remote that is not on GitHub', () => {
			const repositoryPath = TestRepository.create('git@gitlab.com:acme/widgets.git');
			expect(ChangeLogGit.findRepositoryUrl(repositoryPath)).toBeNull();
		});

		it('returns null when the repository has no remote origin', () => {
			const repositoryPath = TestRepository.create();
			TestRepository.git(repositoryPath, ['remote', 'remove', 'origin']);
			expect(ChangeLogGit.findRepositoryUrl(repositoryPath)).toBeNull();
		});
	});
});
