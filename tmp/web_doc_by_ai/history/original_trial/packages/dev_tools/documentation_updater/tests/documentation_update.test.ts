import Fs from 'node:fs';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocumentationGit, DocumentationPaths, DocumentationUpdate } from '../src/index.ts';
import { TestRepository } from './test_repository.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const PAGE_FILE = `${DocumentationPaths.documentationFolder}/index.md`;
const RULE_FILE = `${DocumentationPaths.rulesFolder}/files.md`;
const REPORT = '### Added\n- none\n### Changed\n- none\n### Removed\n- none';
const OUTLINE = '### index.md\n- Action: change\n- Page type: tutorial';

describe('DocumentationUpdate.run', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	const createRepository = (): string => {
		const repositoryPath = TestRepository.create();
		TestRepository.commitFile(repositoryPath, RULE_FILE, 'The rule.', 'Merge pull request #1 from acme/rule', 'Rule');
		TestRepository.commitFile(repositoryPath, PAGE_FILE, '# Intro\n', 'Add the page');
		TestRepository.commitFile(repositoryPath, DocumentationPaths.sidebarConfigFile, 'export default {};\n', 'Add the sidebar');
		return repositoryPath;
	};

	const prompts: string[] = [];
	const modelsAndEfforts: string[] = [];

	/**
	 * A fake coding agent: the outline pass returns an outline, and the writing pass writes a good page.
	 */
	const writeGoodPage = async (
		prompt: string,
		_agentName: string,
		repositoryPath: string,
		_onProgress: unknown,
		isEditAllowed: boolean,
		model: string | undefined,
		effort: string | undefined,
	): Promise<string> => {
		prompts.push(prompt);
		modelsAndEfforts.push(`${model}/${effort}`);
		if (isEditAllowed === false) {
			return OUTLINE;
		}
		Fs.writeFileSync(
			Path.join(repositoryPath, PAGE_FILE),
			`# Intro\n\n${DocumentationPaths.generatedMark}\n<!-- page type: tutorial -->\n\n## Files\n<!-- source: ${RULE_FILE} -->\n`,
		);
		return REPORT;
	};

	it('prints the prompt and changes nothing in a dry run', async () => {
		const repositoryPath = createRepository();
		const result = await DocumentationUpdate.run({
			repositoryPath,
			agentName: 'claude',
			isDryRun: true,
			onlyRuleFiles: [],
			runAgentFn: () => {
				throw new Error('The coding agent must not run in a dry run.');
			},
		});
		expect(result.report).toContain('# Pass 1: the outline prompt');
		expect(result.report).toContain('# Pass 2: the writing prompt');
		expect(result.report).toContain('This is the first run.');
		expect(DocumentationGit.isWorkingTreeClean(repositoryPath)).toBe(true);
	});

	it('allows repeated runs with local changes and preserves the branch, commits, and index', async () => {
		const repositoryPath = createRepository();
		Fs.writeFileSync(Path.join(repositoryPath, 'dirty.txt'), 'existing local change');
		TestRepository.git(repositoryPath, ['add', 'dirty.txt']);
		const currentCommit = DocumentationGit.findCurrentCommit(repositoryPath);
		const branches = TestRepository.git(repositoryPath, ['branch', '--list']);
		const index = TestRepository.git(repositoryPath, ['diff', '--cached']);
		let verificationCount = 0;
		for (let run = 0; run < 2; run++) {
			await DocumentationUpdate.run({
				repositoryPath,
				agentName: 'claude',
				isDryRun: false,
				onlyRuleFiles: [RULE_FILE],
				runAgentFn: writeGoodPage,
				verifyFn: async () => {
					verificationCount++;
				},
			});
		}
		expect(verificationCount).toBe(2);
		expect(DocumentationGit.findCurrentCommit(repositoryPath)).toBe(currentCommit);
		expect(TestRepository.git(repositoryPath, ['branch', '--list'])).toBe(branches);
		expect(TestRepository.git(repositoryPath, ['diff', '--cached'])).toBe(index);
		expect(Fs.readFileSync(Path.join(repositoryPath, 'dirty.txt'), 'utf8')).toBe('existing local change');
		expect(DocumentationGit.isWorkingTreeClean(repositoryPath)).toBe(false);
		expect(DocumentationGit.readLastDocumentedCommit(repositoryPath)).toBeNull();
	});

	it('writes the pages and records the source commit without creating a commit or branch', async () => {
		const repositoryPath = createRepository();
		const currentCommit = DocumentationGit.findCurrentCommit(repositoryPath);
		const result = await DocumentationUpdate.run({
			repositoryPath,
			agentName: 'claude',
			isDryRun: false,
			onlyRuleFiles: [],
			model: 'gpt-5-codex',
			effort: 'high',
			runAgentFn: writeGoodPage,
			verifyFn: async () => {},
		});
		expect(modelsAndEfforts.slice(-2)).toEqual(['gpt-5-codex/high', 'gpt-5-codex/high']);
		expect(prompts.at(-2)).toContain('In this pass you DO NOT edit any file');
		expect(prompts.at(-2)).toContain('Git history is read only in this process.');
		expect(prompts.at(-1)).toContain('Leave generated files uncommitted.');
		expect(prompts.at(-1)).toContain(OUTLINE);
		expect(result.report).toContain(REPORT);
		expect(result.report).toContain('<summary>The outline of the first pass</summary>');
		expect(DocumentationGit.findCurrentBranch(repositoryPath)).toBe('main');
		expect(DocumentationGit.findCurrentCommit(repositoryPath)).toBe(currentCommit);
		expect(TestRepository.git(repositoryPath, ['diff', '--cached'])).toBe('');
		expect(DocumentationGit.readLastDocumentedCommit(repositoryPath)).toBe(currentCommit);
		expect(DocumentationGit.isWorkingTreeClean(repositoryPath)).toBe(false);
	});

	it('fails and makes no branch when the coding agent breaks a rule of the pages', async () => {
		const repositoryPath = createRepository();
		await expect(DocumentationUpdate.run({
			repositoryPath,
			agentName: 'claude',
			isDryRun: false,
			onlyRuleFiles: [],
			runAgentFn: async () => {
				return REPORT;
			},
			verifyFn: async () => {},
		})).rejects.toThrow('has no mark');
		expect(DocumentationGit.findCurrentBranch(repositoryPath)).toBe('main');
	});

	it('refuses to run when the last documented commit is not an ancestor of HEAD', async () => {
		const repositoryPath = createRepository();
		DocumentationGit.writeLastDocumentedCommit(repositoryPath, 'f'.repeat(40));
		TestRepository.git(repositoryPath, ['add', '--all']);
		TestRepository.git(repositoryPath, ['commit', '--quiet', '-m', 'Record a wrong commit']);
		await expect(DocumentationUpdate.run({
			repositoryPath,
			agentName: 'claude',
			isDryRun: false,
			onlyRuleFiles: [],
			runAgentFn: writeGoodPage,
			verifyFn: async () => {},
		})).rejects.toThrow('last_documented_commit');
	});
});
