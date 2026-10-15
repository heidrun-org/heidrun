import { afterEach, describe, expect, it } from 'vitest';
import { DocumentationGit, DocumentationHints, DocumentationPrompt } from '../src/index.ts';
import { TestRepository } from './test_repository.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('DocumentationHints.collect', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	/**
	 * Makes a repository with a documented commit, then two merged pull requests, one of them with a fixed issue, and
	 * one ordinary commit in the code of the application.
	 */
	const createRepository = (): { repositoryPath: string; documentedCommit: string } => {
		const repositoryPath = TestRepository.create();
		TestRepository.commitFile(repositoryPath, 'README.md', 'start', 'Merge pull request #1 from acme/start', 'Start');
		const documentedCommit = TestRepository.commitFile(
			repositoryPath,
			'docs/agents_rules/user_interface/files.md',
			'The Files sidebar section shows the files.',
			'Merge pull request #2 from acme/files',
			'Add the Files sidebar section',
		);
		TestRepository.commitFile(
			repositoryPath,
			'docs/agents_rules/user_interface/files.md',
			'The Files sidebar section shows the files and a context menu.',
			'Add a context menu, fixes #12',
		);
		TestRepository.commitFile(
			repositoryPath,
			'docs/agents_rules/user_interface/tabs.md',
			'A tab has a name.',
			'Merge pull request #3 from acme/tabs',
			'Add the tabs\n\nCloses #15 and Resolves #14.',
		);
		TestRepository.commitFile(
			repositoryPath,
			'packages/apps/web_frontend/src/app.ts',
			'export const app = 1;',
			'Change the code',
		);
		TestRepository.commitFile(repositoryPath, 'notes.txt', 'internal', 'Write a note');
		return {
			repositoryPath,
			documentedCommit,
		};
	};

	it('lists only the pull requests merged after the documented commit', () => {
		const { repositoryPath, documentedCommit } = createRepository();
		const hints = DocumentationHints.collect(repositoryPath, documentedCommit);
		expect(hints.mergedPullRequests.map((pullRequest) => pullRequest.number)).toEqual([3]);
		expect(hints.mergedPullRequests[0].title).toBe('Add the tabs');
	});

	it('lists the issues that the commits after the documented commit fix, without duplicates', () => {
		const { repositoryPath, documentedCommit } = createRepository();
		const hints = DocumentationHints.collect(repositoryPath, documentedCommit);
		expect(hints.fixedIssueNumbers).toEqual([12, 14, 15]);
	});

	it('lists the changed files of the application and of the rules, and no other file', () => {
		const { repositoryPath, documentedCommit } = createRepository();
		const hints = DocumentationHints.collect(repositoryPath, documentedCommit);
		expect(hints.changedFiles).toEqual([
			'docs/agents_rules/user_interface/files.md',
			'docs/agents_rules/user_interface/tabs.md',
			'packages/apps/web_frontend/src/app.ts',
		]);
	});

	it('gives the diff of the rules only', () => {
		const { repositoryPath, documentedCommit } = createRepository();
		const hints = DocumentationHints.collect(repositoryPath, documentedCommit);
		expect(hints.rulesDiff).toContain('+The Files sidebar section shows the files and a context menu.');
		expect(hints.rulesDiff).toContain('+A tab has a name.');
		expect(hints.rulesDiff).not.toContain('export const app');
		expect(hints.isRulesDiffTruncated).toBe(false);
	});

	it('records the current commit', () => {
		const { repositoryPath, documentedCommit } = createRepository();
		const hints = DocumentationHints.collect(repositoryPath, documentedCommit);
		expect(hints.currentCommit).toBe(DocumentationGit.findCurrentCommit(repositoryPath));
		expect(hints.lastDocumentedCommit).toBe(documentedCommit);
	});

	it('gives no hint on the first run', () => {
		const { repositoryPath } = createRepository();
		const hints = DocumentationHints.collect(repositoryPath, null);
		expect(hints.mergedPullRequests).toEqual([]);
		expect(hints.fixedIssueNumbers).toEqual([]);
		expect(hints.changedFiles).toEqual([]);
		expect(hints.rulesDiff).toBe('');
	});

	it('puts the hints in the prompt, and says that the first run has none', () => {
		const { repositoryPath, documentedCommit } = createRepository();
		const hints = DocumentationHints.collect(repositoryPath, documentedCommit);
		const prompt = DocumentationPrompt.buildWriting(hints, [], 'THE OUTLINE');
		expect(prompt).toContain('THE OUTLINE');
		expect(prompt).toContain('<!-- page type: how-to -->');
		expect(prompt).toContain('## Troubleshooting');
		expect(prompt).toContain('## Related pages');
		const outlinePrompt = DocumentationPrompt.buildOutline(hints);
		expect(outlinePrompt).toContain('- #3: Add the tabs');
		expect(outlinePrompt).toContain('In this pass you DO NOT edit any file');
		expect(outlinePrompt).toContain('Page type: tutorial | how-to | reference | explanation');
		expect(prompt).toContain('- #3: Add the tabs');
		expect(prompt).toContain('- #12');
		expect(prompt).toContain('<!-- generated by docs:update_by_ai -->');
		expect(prompt).toContain('A paragraph has at most three sentences.');
		expect(prompt).toContain('Write the steps of a task as a numbered list');
		const firstRunPrompt = DocumentationPrompt.buildOutline(DocumentationHints.collect(repositoryPath, null));
		expect(firstRunPrompt).toContain('This is the first run.');
	});
});

describe('DocumentationGit.isAncestor', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	it('is true for an older commit and false for a commit of another branch', () => {
		const repositoryPath = TestRepository.create();
		const firstCommit = TestRepository.commitFile(repositoryPath, 'a.txt', 'a', 'First');
		TestRepository.git(repositoryPath, ['switch', '--create', 'other']);
		const otherCommit = TestRepository.commitFile(repositoryPath, 'b.txt', 'b', 'Other');
		TestRepository.git(repositoryPath, ['switch', 'main']);
		TestRepository.commitFile(repositoryPath, 'c.txt', 'c', 'Second');
		expect(DocumentationGit.isAncestor(repositoryPath, firstCommit, 'HEAD')).toBe(true);
		expect(DocumentationGit.isAncestor(repositoryPath, otherCommit, 'HEAD')).toBe(false);
	});
});
