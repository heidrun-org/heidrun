import { describe, expect, it } from 'vitest';
import { ChangeLogRenderer } from './change_log_renderer.ts';
import type { MergedPullRequest } from './change_log_types.ts';

const MERGED_PULL_REQUESTS: MergedPullRequest[] = [
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
];

const REPOSITORY_URL = 'https://github.com/acme/widgets';

const OLDER_SECTIONS = [
	'## [1.0.0] - 2026-01-01',
	'',
	'### Added',
	'',
	'- The first version.',
	'',
	'## [0.9.0] - 2025-12-01',
	'',
	'- A beta version.',
	'',
	'[1.0.0]: https://example.com/1.0.0',
	'',
].join('\n');

describe('ChangeLogRenderer', () => {
	describe('renderMechanicalSection', () => {
		it('writes one bullet for each pull request, with its title and its link, and no category', () => {
			expect(ChangeLogRenderer.renderMechanicalSection(MERGED_PULL_REQUESTS, REPOSITORY_URL, 'v1.0.0')).toBe([
				'## [Unreleased]',
				'',
				'- Fix the bug ([#8](https://github.com/acme/widgets/pull/8))',
				'- Add the thing ([#7](https://github.com/acme/widgets/pull/7))',
			].join('\n'));
		});

		it('writes the plain number when the address of the repository is not known', () => {
			expect(ChangeLogRenderer.renderMechanicalSection(MERGED_PULL_REQUESTS, null, 'v1.0.0')).toBe([
				'## [Unreleased]',
				'',
				'- Fix the bug (#8)',
				'- Add the thing (#7)',
			].join('\n'));
		});

		it('says that nothing was merged when the list is empty', () => {
			expect(ChangeLogRenderer.renderMechanicalSection([], REPOSITORY_URL, 'v1.0.0'))
				.toBe('## [Unreleased]\n\nNo merged pull request since v1.0.0.');
			expect(ChangeLogRenderer.renderMechanicalSection([], REPOSITORY_URL, null))
				.toBe('## [Unreleased]\n\nNo merged pull request.');
		});
	});

	describe('buildPrompt', () => {
		it('holds the rules, the last release, and the message of every merge commit', () => {
			const prompt = ChangeLogRenderer.buildPrompt(MERGED_PULL_REQUESTS, REPOSITORY_URL, 'v1.0.0');
			expect(prompt).toContain('since the release v1.0.0');
			expect(prompt).toContain('Keep a Changelog 1.1.0');
			expect(prompt).toContain('"## [Unreleased]"');
			expect(prompt).toContain(
				'"### Added", "### Changed", "### Deprecated", "### Removed", "### Fixed", "### Security"',
			);
			expect(prompt).toContain('Leave out a heading that has no change.');
			expect(prompt).toContain('([#116](https://github.com/acme/widgets/pull/116))');
			expect(prompt).toContain('Pull request #8\nBranch: acme/fix-bug');
			expect(prompt).toContain('Merge pull request #7 from acme/add-thing\n\nAdd the thing');
		});

		it('says "the start of the project" when there is no release', () => {
			expect(ChangeLogRenderer.buildPrompt(MERGED_PULL_REQUESTS, null, null)).toContain('since the start of the project');
		});
	});

	describe('cleanAgentAnswer', () => {
		it('keeps a good answer', () => {
			expect(ChangeLogRenderer.cleanAgentAnswer('\n## [Unreleased]\n\n### Added\n\n- A thing.\n\n'))
				.toBe('## [Unreleased]\n\n### Added\n\n- A thing.');
		});

		it('removes a code fence around the answer', () => {
			expect(ChangeLogRenderer.cleanAgentAnswer('```markdown\n## [Unreleased]\n\n- A thing.\n```'))
				.toBe('## [Unreleased]\n\n- A thing.');
		});

		it('writes the exact heading when the coding agent writes another heading of level 2', () => {
			expect(ChangeLogRenderer.cleanAgentAnswer('## Unreleased\n\n- A thing.')).toBe('## [Unreleased]\n\n- A thing.');
		});

		it('throws an error with the answer when the answer is not a section', () => {
			expect(() => {
				ChangeLogRenderer.cleanAgentAnswer('Sure! Here is the change log.');
			}).toThrow('did not answer with a section of the change log:\nSure! Here is the change log.');
			expect(() => {
				ChangeLogRenderer.cleanAgentAnswer('');
			}).toThrow('did not answer with a section');
		});
	});

	describe('insertSection', () => {
		const section = '## [Unreleased]\n\n- A new thing.';

		it('creates the file with the Keep a Changelog header when the file does not exist', () => {
			const text = ChangeLogRenderer.insertSection(null, section);
			expect(text.startsWith('# Changelog\n\nAll notable changes to this project are documented')).toBe(true);
			expect(text).toContain('[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)');
			expect(text.endsWith('\n\n## [Unreleased]\n\n- A new thing.\n')).toBe(true);
		});

		it('puts the new section below the header and does not change the older sections', () => {
			const header = '# Changelog\n\nSome words.\n\n';
			const text = ChangeLogRenderer.insertSection(`${header}${OLDER_SECTIONS}`, section);
			expect(text).toBe(`${header}${section}\n\n${OLDER_SECTIONS}`);
			expect(text.endsWith(OLDER_SECTIONS)).toBe(true);
		});

		it('replaces an existing section Unreleased and does not change the older sections', () => {
			const header = '# Changelog\n\nSome words.\n\n';
			const existing = `${header}## [Unreleased]\n\n- An old entry.\n\n${OLDER_SECTIONS}`;
			const text = ChangeLogRenderer.insertSection(existing, section);
			expect(text).toBe(`${header}${section}\n\n${OLDER_SECTIONS}`);
			expect(text).not.toContain('An old entry.');
		});

		it('replaces a section Unreleased that is the last section of the file', () => {
			const existing = '# Changelog\n\n## [Unreleased]\n\n- An old entry.\n';
			expect(ChangeLogRenderer.insertSection(existing, section)).toBe(`# Changelog\n\n${section}\n`);
		});

		it('adds the section at the end when the file has no section yet', () => {
			expect(ChangeLogRenderer.insertSection('# Changelog\n\nSome words.\n', section))
				.toBe(`# Changelog\n\nSome words.\n\n${section}\n`);
		});
	});
});
