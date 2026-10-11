import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TargetPaths } from '../src/target_paths.ts';
import { WorktreeCreate } from '../src/worktree_create.ts';
import { TestRepository } from './test_repository.ts';

describe('WorktreeCreate', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	describe('run', () => {
		it('creates the worktree in .claude/worktrees on a new branch with the same name', () => {
			const mainCheckoutPath = TestRepository.create();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'fix-thing-12',
			});
			const expectedWorktreePath = Path.join(mainCheckoutPath, '.claude', 'worktrees', 'fix-thing-12');
			expect(result.worktreePath).toBe(expectedWorktreePath);
			expect(result.branchName).toBe('fix-thing-12');
			expect(TestRepository.git(expectedWorktreePath, ['branch', '--show-current']).trim()).toBe('fix-thing-12');
		});

		it('starts the new branch at the base reference', () => {
			const mainCheckoutPath = TestRepository.create();
			TestRepository.git(mainCheckoutPath, ['commit', '--quiet', '--allow-empty', '-m', 'Second commit']);
			TestRepository.git(mainCheckoutPath, ['branch', 'older', 'HEAD~1']);
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'from-older',
				baseRef: 'older',
			});
			const subject = TestRepository.git(result.worktreePath, ['log', '-1', '--format=%s']).trim();
			expect(subject).toBe('Initial commit');
		});

		it('finds the main checkout when it runs inside another worktree', () => {
			const mainCheckoutPath = TestRepository.create();
			const firstWorktreePath = TestRepository.addWorktree(mainCheckoutPath, 'first');
			const result = WorktreeCreate.run({
				workingDirectory: firstWorktreePath,
				name: 'second',
			});
			expect(result.worktreePath).toBe(Path.join(mainCheckoutPath, '.claude', 'worktrees', 'second'));
		});

		it.skipIf(process.platform !== 'darwin')('clones the debug folder of the main checkout', () => {
			const mainCheckoutPath = TestRepository.createWithBuiltTarget();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'with-clone',
			});
			expect(result.isTargetCloned).toBe(true);
			expect(result.skipReason).toBeNull();

			const sourceFilePath = Path.join(TargetPaths.debugPath(mainCheckoutPath), 'deps', 'libserde.rlib');
			const cloneFilePath = Path.join(TargetPaths.debugPath(result.worktreePath), 'deps', 'libserde.rlib');
			expect(Fs.readFileSync(cloneFilePath, 'utf8')).toBe('compiled dependency');
			expect(Fs.statSync(cloneFilePath).mtimeMs).toBe(Fs.statSync(sourceFilePath).mtimeMs);

			Fs.writeFileSync(cloneFilePath, 'changed in the worktree');
			expect(Fs.readFileSync(sourceFilePath, 'utf8')).toBe('compiled dependency');
		});

		it('creates the worktree without a clone when the main checkout has no debug folder', () => {
			const mainCheckoutPath = TestRepository.create();
			const result = WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'no-build',
			});
			expect(Fs.existsSync(result.worktreePath)).toBe(true);
			expect(result.isTargetCloned).toBe(false);
			expect(result.skipReason).not.toBeNull();
			expect(Fs.existsSync(TargetPaths.targetPath(result.worktreePath))).toBe(false);
		});

		it('throws when the name is not a valid branch name', () => {
			const mainCheckoutPath = TestRepository.create();
			expect(() => {
				WorktreeCreate.run({
					workingDirectory: mainCheckoutPath,
					name: 'bad name',
				});
			}).toThrow('is not a valid branch name');
		});

		it('throws when the folder of the worktree exists already', () => {
			const mainCheckoutPath = TestRepository.create();
			WorktreeCreate.run({
				workingDirectory: mainCheckoutPath,
				name: 'twice',
			});
			expect(() => {
				WorktreeCreate.run({
					workingDirectory: mainCheckoutPath,
					name: 'twice',
				});
			}).toThrow('exists already');
		});

		it('throws when the branch exists already', () => {
			const mainCheckoutPath = TestRepository.create();
			TestRepository.git(mainCheckoutPath, ['branch', 'taken']);
			expect(() => {
				WorktreeCreate.run({
					workingDirectory: mainCheckoutPath,
					name: 'taken',
				});
			}).toThrow('already exists');
		});
	});
});
