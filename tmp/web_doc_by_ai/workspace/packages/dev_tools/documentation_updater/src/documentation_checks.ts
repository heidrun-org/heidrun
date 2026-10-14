import Fs from 'node:fs';
import Path from 'node:path';
import { DocumentationGit } from './documentation_git.ts';
import { DocumentationPaths } from './documentation_paths.ts';
import { DocumentationPrompt } from './documentation_prompt.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationChecks — tests that the generated documentation follows its rules
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Tests the generated documentation. Each method returns the list of problems. An empty list means that the test
 * passes. The command runs the tests after the coding agent, and the Vitest tests of the repository run them too.
 */
export class DocumentationChecks {
	/**
	 * Runs all the tests.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param pagePaths The pages to check; by default, every documentation page except shortcuts.
	 * @returns All the problems of all the tests.
	 */
	static checkAll(
		repositoryPath: string,
		pagePaths: string[] = DocumentationChecks.listGeneratedPages(repositoryPath),
	): string[] {
		return [
			...DocumentationChecks.checkLastDocumentedCommit(repositoryPath),
			...DocumentationChecks.checkGeneratedPageMarks(repositoryPath, pagePaths),
			...DocumentationChecks.checkPageTypes(repositoryPath, pagePaths),
			...DocumentationChecks.checkSourceRuleFiles(repositoryPath, pagePaths),
		];
	}

	/**
	 * Tests that the last documented commit is an ancestor of `HEAD`. A missing file passes: it is the first run.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns The problems, or an empty list.
	 */
	static checkLastDocumentedCommit(repositoryPath: string): string[] {
		const lastDocumentedCommit = DocumentationGit.readLastDocumentedCommit(repositoryPath);
		if (lastDocumentedCommit === null) {
			return [];
		}
		try {
			if (DocumentationGit.isAncestor(repositoryPath, lastDocumentedCommit, 'HEAD') === true) {
				return [];
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return [`${DocumentationPaths.lastDocumentedCommitFile} holds ${lastDocumentedCommit}, which git cannot read: ${message}`];
		}
		return [`${DocumentationPaths.lastDocumentedCommitFile} holds ${lastDocumentedCommit}, which is not an ancestor of HEAD.`];
	}

	/**
	 * Tests that every page of the documentation has the mark of the generator, except the page of the shortcuts.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param pagePaths The pages to check; by default, every documentation page except shortcuts.
	 * @returns The problems, or an empty list.
	 */
	static checkGeneratedPageMarks(
		repositoryPath: string,
		pagePaths: string[] = DocumentationChecks.listGeneratedPages(repositoryPath),
	): string[] {
		const problems: string[] = [];
		for (const pagePath of pagePaths) {
			const text = Fs.readFileSync(pagePath, 'utf8');
			if (text.includes(DocumentationPaths.generatedMark) === false) {
				problems.push(`${Path.relative(repositoryPath, pagePath)} has no mark ${DocumentationPaths.generatedMark}`);
			}
		}
		return problems;
	}

	/**
	 * Tests that every generated page names one page type of the Diátaxis framework, in a comment
	 * `<!-- page type: how-to -->`.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param pagePaths The pages to check; by default, every documentation page except shortcuts.
	 * @returns The problems, or an empty list.
	 */
	static checkPageTypes(
		repositoryPath: string,
		pagePaths: string[] = DocumentationChecks.listGeneratedPages(repositoryPath),
	): string[] {
		const problems: string[] = [];
		for (const pagePath of pagePaths) {
			const match = DocumentationPaths.pageTypeCommentPattern.exec(Fs.readFileSync(pagePath, 'utf8'));
			const pageName = Path.relative(repositoryPath, pagePath);
			if (match === null) {
				problems.push(`${pageName} has no comment <!-- page type: ... -->`);
				continue;
			}
			if (DocumentationPrompt.pageTypes.includes(match[1]) === false) {
				problems.push(`${pageName} has the unknown page type "${match[1]}". Use ${DocumentationPrompt.pageTypes.join(', ')}.`);
			}
		}
		return problems;
	}

	/**
	 * Tests that every `<!-- source: ... -->` comment of a generated page names a file that exists.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param pagePaths The pages to check; by default, every documentation page except shortcuts.
	 * @returns The problems, or an empty list.
	 */
	static checkSourceRuleFiles(
		repositoryPath: string,
		pagePaths: string[] = DocumentationChecks.listGeneratedPages(repositoryPath),
	): string[] {
		const problems: string[] = [];
		for (const pagePath of pagePaths) {
			const text = Fs.readFileSync(pagePath, 'utf8');
			for (const match of text.matchAll(DocumentationPaths.sourceCommentPattern)) {
				const sourcePath = match[1];
				if (Fs.existsSync(Path.join(repositoryPath, sourcePath)) === false) {
					problems.push(`${Path.relative(repositoryPath, pagePath)} names the source ${sourcePath}, which does not exist.`);
				}
			}
		}
		return problems;
	}

	/**
	 * Lists the pages that the coding agent owns: every Markdown file of the documentation folder, at every depth,
	 * except the page of the shortcuts.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns The absolute paths of the pages.
	 */
	static listGeneratedPages(repositoryPath: string): string[] {
		const documentationPath = Path.join(repositoryPath, DocumentationPaths.documentationFolder);
		const pagePaths: string[] = [];
		if (Fs.existsSync(documentationPath) === false) {
			return pagePaths;
		}
		const walk = (folderPath: string): void => {
			for (const entry of Fs.readdirSync(folderPath, { withFileTypes: true })) {
				const entryPath = Path.join(folderPath, entry.name);
				if (entry.isDirectory() === true) {
					walk(entryPath);
					continue;
				}
				const isPage = entry.name.endsWith('.md') === true;
				const isShortcutsPage = entryPath === Path.join(documentationPath, DocumentationPaths.shortcutsPageName);
				if (isPage === true && isShortcutsPage === false) {
					pagePaths.push(entryPath);
				}
			}
		};
		walk(documentationPath);
		return pagePaths.sort();
	}
}
