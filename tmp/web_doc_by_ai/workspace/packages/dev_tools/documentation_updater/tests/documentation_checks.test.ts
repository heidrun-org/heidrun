import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocumentationChecks, DocumentationGit, DocumentationPaths } from '../src/index.ts';
import { TestRepository } from './test_repository.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const MARK = DocumentationPaths.generatedMark;
const PAGE_PATH = `${DocumentationPaths.documentationFolder}/files.md`;
const RULE_PATH = `${DocumentationPaths.rulesFolder}/files.md`;

describe('DocumentationChecks', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	/**
	 * Makes a repository with one rule file, one generated page, and one page of the shortcuts without a mark.
	 */
	const createRepository = (pageText: string): string => {
		const repositoryPath = TestRepository.create();
		TestRepository.commitFile(repositoryPath, RULE_PATH, 'The rule.', 'Add the rule');
		TestRepository.commitFile(
			repositoryPath,
			`${DocumentationPaths.documentationFolder}/${DocumentationPaths.shortcutsPageName}`,
			'# Keyboard shortcuts\n',
			'Add the shortcuts page',
		);
		TestRepository.commitFile(repositoryPath, PAGE_PATH, pageText, 'Add the page');
		return repositoryPath;
	};

	const goodPage = `# Files\n\n${MARK}\n<!-- page type: how-to -->\n\n## The list\n<!-- source: ${RULE_PATH} -->\n\nText.\n`;

	it('passes for a page with its mark and an existing source, and ignores the shortcuts page', () => {
		const repositoryPath = createRepository(goodPage);
		expect(DocumentationChecks.checkAll(repositoryPath)).toEqual([]);
	});

	it('fails when a generated page has no mark', () => {
		const repositoryPath = createRepository('# Files\n\nText.\n');
		const problems = DocumentationChecks.checkGeneratedPageMarks(repositoryPath);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain(PAGE_PATH);
	});

	it('fails when a generated page has no page type, or an unknown one', () => {
		const repositoryPath = createRepository(`# Files\n\n${MARK}\n\n## The list\n`);
		expect(DocumentationChecks.checkPageTypes(repositoryPath)[0]).toContain('has no comment <!-- page type');
		const otherPath = createRepository(`# Files\n\n${MARK}\n<!-- page type: guide -->\n`);
		expect(DocumentationChecks.checkPageTypes(otherPath)[0]).toContain('unknown page type "guide"');
	});

	it('fails when a section names a source rule file that does not exist', () => {
		const repositoryPath = createRepository(`# Files\n\n${MARK}\n\n## The list\n<!-- source: docs/missing.md -->\n`);
		const problems = DocumentationChecks.checkSourceRuleFiles(repositoryPath);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain('docs/missing.md');
	});

	it('passes when .last_documented_commit does not exist (the first run)', () => {
		const repositoryPath = createRepository(goodPage);
		expect(DocumentationChecks.checkLastDocumentedCommit(repositoryPath)).toEqual([]);
	});

	it('passes when .last_documented_commit is an ancestor of HEAD', () => {
		const repositoryPath = createRepository(goodPage);
		const firstCommit = TestRepository.git(repositoryPath, ['rev-list', '--max-parents=0', 'HEAD']).trim();
		DocumentationGit.writeLastDocumentedCommit(repositoryPath, firstCommit);
		expect(DocumentationChecks.checkLastDocumentedCommit(repositoryPath)).toEqual([]);
	});

	it('fails when .last_documented_commit is not an ancestor of HEAD', () => {
		const repositoryPath = createRepository(goodPage);
		TestRepository.git(repositoryPath, ['switch', '--create', 'other', 'HEAD~1']);
		const otherCommit = TestRepository.commitFile(repositoryPath, 'other.txt', 'other', 'Other');
		TestRepository.git(repositoryPath, ['switch', 'main']);
		DocumentationGit.writeLastDocumentedCommit(repositoryPath, otherCommit);
		const problems = DocumentationChecks.checkLastDocumentedCommit(repositoryPath);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain('not an ancestor of HEAD');
	});

	it('fails when .last_documented_commit holds a commit that does not exist', () => {
		const repositoryPath = createRepository(goodPage);
		DocumentationGit.writeLastDocumentedCommit(repositoryPath, 'f'.repeat(40));
		expect(DocumentationChecks.checkLastDocumentedCommit(repositoryPath)).toHaveLength(1);
	});
});

describe('the real documentation of the repository', () => {
	const repositoryPath = Path.resolve(import.meta.dirname, '../../../..');

	it('has a mark on every generated page', () => {
		expect(DocumentationChecks.checkGeneratedPageMarks(repositoryPath)).toEqual([]);
	});

	it('names a known page type on every generated page', () => {
		expect(DocumentationChecks.checkPageTypes(repositoryPath)).toEqual([]);
	});

	it('names only source rule files that exist', () => {
		expect(DocumentationChecks.checkSourceRuleFiles(repositoryPath)).toEqual([]);
	});

	it('has a last documented commit that is an ancestor of HEAD', () => {
		expect(Fs.existsSync(repositoryPath)).toBe(true);
		expect(DocumentationChecks.checkLastDocumentedCommit(repositoryPath)).toEqual([]);
	});
});
