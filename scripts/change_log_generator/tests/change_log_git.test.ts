import { afterEach, describe, expect, it } from 'vitest';
import { ChangeLogGit } from '../src/git/change_log_git.ts';
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

		it('finds the release before another release when the tag of that release is skipped', () => {
			const repositoryPath = TestRepository.createWithThreeReleases();
			expect(ChangeLogGit.findLastTag(repositoryPath, 'v2.0.0', 'v2.0.0')).toBe('v1.1.0');
			expect(ChangeLogGit.findLastTag(repositoryPath, 'v1.1.0', 'v1.1.0')).toBe('v1.0.0');
			expect(ChangeLogGit.findLastTag(repositoryPath, 'v1.0.0', 'v1.0.0')).toBeNull();
			expect(ChangeLogGit.findLastTag(repositoryPath)).toBe('v2.0.0');
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
			expect(ChangeLogGit.listMergedPullRequests(repositoryPath, {
				fromTag: 'v1.0.0',
				toTag: null,
			})).toEqual([
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
			const numbers = ChangeLogGit.listMergedPullRequests(repositoryPath, {
				fromTag: null,
				toTag: null,
			}).map((mergedPullRequest) => {
				return mergedPullRequest.number;
			});
			expect(numbers).toEqual([8, 7, 3]);
		});

		it('uses the name of the branch as the title when the merge commit has no body', () => {
			const repositoryPath = TestRepository.createWithRelease();
			TestRepository.commit(repositoryPath, 'Merge pull request #9 from acme/no-body');
			const [newest] = ChangeLogGit.listMergedPullRequests(repositoryPath, {
				fromTag: 'v1.0.0',
				toTag: null,
			});
			expect(newest.title).toBe('acme/no-body');
			expect(newest.message).toBe('Merge pull request #9 from acme/no-body');
		});

		it('returns an empty list when nothing was merged after the tag', () => {
			const repositoryPath = TestRepository.create();
			TestRepository.commit(repositoryPath, 'Merge pull request #3 from acme/old-work', 'Do the old work');
			TestRepository.git(repositoryPath, ['tag', 'v1.0.0']);
			expect(ChangeLogGit.listMergedPullRequests(repositoryPath, {
				fromTag: 'v1.0.0',
				toTag: null,
			})).toEqual([]);
		});
	});

	describe('listMergedPullRequests, with a range between two releases', () => {
		const numbersOf = (repositoryPath: string, fromTag: string | null, toTag: string | null): number[] => {
			return ChangeLogGit.listMergedPullRequests(repositoryPath, {
				fromTag,
				toTag,
			}).map((mergedPullRequest) => {
				return mergedPullRequest.number;
			});
		};

		it.each([
			[null, 'v1.0.0', [1]],
			[null, 'v2.0.0', [4, 3, 2, 1]],
			['v1.0.0', 'v1.1.0', [3, 2]],
			['v1.1.0', 'v2.0.0', [4]],
			['v1.1.0', null, [5, 4]],
			[null, null, [5, 4, 3, 2, 1]],
		])('from %s to %s lists the pull requests %j', (fromTag, toTag, expectedNumbers) => {
			const repositoryPath = TestRepository.createWithThreeReleases();
			expect(numbersOf(repositoryPath, fromTag, toTag)).toEqual(expectedNumbers);
		});
	});

	describe('tagExists', () => {
		it('tells if a tag exists', () => {
			const repositoryPath = TestRepository.createWithThreeReleases();
			expect(ChangeLogGit.tagExists(repositoryPath, 'v1.1.0')).toBe(true);
			expect(ChangeLogGit.tagExists(repositoryPath, 'v9.9.9')).toBe(false);
			expect(ChangeLogGit.tagExists(repositoryPath, 'HEAD')).toBe(false);
		});
	});

	describe('findTagDate', () => {
		it('returns the date of the commit of the tag', () => {
			const repositoryPath = TestRepository.createWithThreeReleases();
			expect(ChangeLogGit.findTagDate(repositoryPath, 'v1.0.0')).toBe('2026-01-10');
			expect(ChangeLogGit.findTagDate(repositoryPath, 'v1.1.0')).toBe('2026-02-20');
			expect(ChangeLogGit.findTagDate(repositoryPath, 'v2.0.0')).toBe('2026-03-30');
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
