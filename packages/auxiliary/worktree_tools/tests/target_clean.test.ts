import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TargetClean } from '../src/target_clean.ts';
import { TargetPaths } from '../src/target_paths.ts';
import { TestRepository } from './test_repository.ts';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

describe('TargetClean', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	describe('findStale', () => {
		it('lists the target folder of a worktree that no build used for the minimum number of days', () => {
			const mainCheckoutPath = TestRepository.createWithBuiltTarget();
			const oldWorktreePath = TestRepository.addWorktree(mainCheckoutPath, 'old');
			TestRepository.writeTargetFile(oldWorktreePath, 'debug/heidrun', 'compiled application');
			TestRepository.ageTarget(oldWorktreePath, 10);

			const staleTargetFolders = TargetClean.findStale({
				workingDirectory: mainCheckoutPath,
				minimumAgeInDays: 7,
				now: new Date(),
			});
			expect(staleTargetFolders).toHaveLength(1);
			expect(staleTargetFolders[0]?.worktreePath).toBe(oldWorktreePath);
			expect(staleTargetFolders[0]?.targetPath).toBe(TargetPaths.targetPath(oldWorktreePath));
			expect(staleTargetFolders[0]?.ageInDays).toBe(10);
		});

		it('does not list a worktree that a build used during the last days', () => {
			const mainCheckoutPath = TestRepository.create();
			const recentWorktreePath = TestRepository.addWorktree(mainCheckoutPath, 'recent');
			TestRepository.writeTargetFile(recentWorktreePath, 'debug/heidrun', 'compiled application');
			TestRepository.ageTarget(recentWorktreePath, 2);
			expect(TargetClean.findStale({
				workingDirectory: mainCheckoutPath,
				minimumAgeInDays: 7,
				now: new Date(),
			})).toEqual([]);
		});

		it('does not list a worktree when one file deep inside the target folder is recent', () => {
			const mainCheckoutPath = TestRepository.create();
			const worktreePath = TestRepository.addWorktree(mainCheckoutPath, 'rebuilt');
			TestRepository.writeTargetFile(worktreePath, 'debug/heidrun', 'compiled application');
			TestRepository.ageTarget(worktreePath, 30);
			TestRepository.writeTargetFile(worktreePath, 'debug/deps/new.rlib', 'rebuilt yesterday');
			Fs.utimesSync(
				Path.join(TargetPaths.debugPath(worktreePath), 'deps', 'new.rlib'),
				TestRepository.daysAgo(1),
				TestRepository.daysAgo(1),
			);
			expect(TargetClean.findStale({
				workingDirectory: mainCheckoutPath,
				minimumAgeInDays: 7,
				now: new Date(),
			})).toEqual([]);
		});

		it('never lists the target folder of the main checkout', () => {
			const mainCheckoutPath = TestRepository.createWithBuiltTarget();
			TestRepository.ageTarget(mainCheckoutPath, 90);
			TestRepository.addWorktree(mainCheckoutPath, 'empty');
			expect(TargetClean.findStale({
				workingDirectory: mainCheckoutPath,
				minimumAgeInDays: 0,
				now: new Date(),
			})).toEqual([]);
		});

		it('skips a worktree that has no target folder', () => {
			const mainCheckoutPath = TestRepository.create();
			TestRepository.addWorktree(mainCheckoutPath, 'no-target');
			expect(TargetClean.findStale({
				workingDirectory: mainCheckoutPath,
				minimumAgeInDays: 0,
				now: new Date(Date.now() + 30 * MILLISECONDS_PER_DAY),
			})).toEqual([]);
		});

		it('lists the oldest target folder first, and works from inside a worktree', () => {
			const mainCheckoutPath = TestRepository.create();
			const youngerWorktreePath = TestRepository.addWorktree(mainCheckoutPath, 'younger');
			const olderWorktreePath = TestRepository.addWorktree(mainCheckoutPath, 'older');
			TestRepository.writeTargetFile(youngerWorktreePath, 'debug/heidrun', 'compiled application');
			TestRepository.writeTargetFile(olderWorktreePath, 'debug/heidrun', 'compiled application');
			TestRepository.ageTarget(youngerWorktreePath, 9);
			TestRepository.ageTarget(olderWorktreePath, 20);
			const staleTargetFolders = TargetClean.findStale({
				workingDirectory: youngerWorktreePath,
				minimumAgeInDays: 7,
				now: new Date(),
			});
			expect(staleTargetFolders.map((staleTargetFolder) => {
				return staleTargetFolder.worktreePath;
			})).toEqual([olderWorktreePath, youngerWorktreePath]);
		});
	});

	describe('remove', () => {
		it('deletes the listed target folders and nothing else', () => {
			const mainCheckoutPath = TestRepository.createWithBuiltTarget();
			const oldWorktreePath = TestRepository.addWorktree(mainCheckoutPath, 'old');
			TestRepository.writeTargetFile(oldWorktreePath, 'debug/heidrun', 'compiled application');
			TestRepository.ageTarget(oldWorktreePath, 10);

			TargetClean.remove(TargetClean.findStale({
				workingDirectory: mainCheckoutPath,
				minimumAgeInDays: 7,
				now: new Date(),
			}));
			expect(Fs.existsSync(TargetPaths.targetPath(oldWorktreePath))).toBe(false);
			expect(Fs.existsSync(oldWorktreePath)).toBe(true);
			expect(Fs.existsSync(Path.join(TargetPaths.debugPath(mainCheckoutPath), 'heidrun'))).toBe(true);
		});
	});
});
