import { afterEach, describe, expect, it } from 'vitest';
import { DocumentationJudge, DocumentationMeasures, DocumentationPaths } from '../src/index.ts';
import { PAGE_CRITERIA } from '../src/documentation_judge_types.ts';
import { TestRepository } from './test_repository.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const MARK = DocumentationPaths.generatedMark;

const WALL_PAGE = `# Files\n\n${MARK}\n<!-- page type: how-to -->\n\nOne. Two. Three. Four. Five.\n\nSix. Seven.\n`;

const GOOD_PAGE = [
	'# Copy a file path',
	'',
	MARK,
	'<!-- page type: how-to -->',
	'',
	'Copy the path of a file to paste it elsewhere.',
	'',
	'## Steps',
	'<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->',
	'',
	'1. Right-click a file.',
	'2. Select **Copy relative path**.',
	'',
	'| Item | What it does |',
	'| --- | --- |',
	'| **Copy absolute path** | Copies the full path. |',
	'',
	'## Troubleshooting',
	'',
	'### Nothing happens on a right-click',
	'',
	'**Cause**: the row is a folder.',
	'',
	'## Related pages',
	'',
	'- [Create a file](/documentation/create_a_file): to add a file first',
	'- [Files](/documentation/files): the buttons of the header',
	'',
].join('\n');

/**
 * Builds the JSON answer of a fake judge.
 * @param files The file names of the judged pages.
 * @param score The score of every criterion.
 * @returns The answer, inside a code fence with some text around, as a coding agent often writes it.
 */
const buildAnswer = (files: string[], score: number): string => {
	const scores = {
		taskSuccess: score,
		usefulness: score,
		order: score,
		singleType: score,
		userLanguage: score,
		accuracy: score,
	};
	const finding = {
		severity: ({ 1: 'unusable', 2: 'blocker', 3: 'material', 4: 'minor', 5: 'suggestion' } as Record<number, string>)[score] ?? 'minor',
		location: 'Steps',
		evidence: 'The instruction omits the required selection.',
		impact: 'The reader must guess which row to select.',
		source: null,
		sourceEvidence: null,
		recommendation: 'State which row to select.',
	};
	const answer = {
		rubricVersion: '3',
		limitations: [],
		pages: files.map((file) => {
			return {
				file,
				scores,
				findings: PAGE_CRITERIA.map((criterion) => ({ ...finding, criterion })),
				problems: ['Merge steps 2 and 3.'],
				verdict: 'A fair page.',
			};
		}),
		site: {
			navigation: 2,
			consistency: 4,
			findings: [
				{ ...finding, criterion: 'navigation', severity: 'blocker' },
				{ ...finding, criterion: 'consistency', severity: 'minor' },
			],
			problems: [],
		},
	};
	return `Here is my verdict:\n\`\`\`json\n${JSON.stringify(answer)}\n\`\`\`\n`;
};

describe('DocumentationMeasures.measure', () => {
	it('finds the long paragraph and the paragraphs in a row of a wall of text', () => {
		const measures = DocumentationMeasures.measure(WALL_PAGE);
		expect(measures.pageType).toBe('how-to');
		expect(measures.longestParagraphSentences).toBe(5);
		expect(measures.paragraphRuns).toBe(1);
		expect(measures.numberedStepCount).toBe(0);
		expect(measures.tableCount).toBe(0);
		expect(measures.hasTroubleshooting).toBe(false);
		expect(measures.relatedPageLinkCount).toBe(0);
	});

	it('counts the steps and the tables of a structured page, and ignores the comments', () => {
		const measures = DocumentationMeasures.measure(GOOD_PAGE);
		expect(measures.numberedStepCount).toBe(2);
		expect(measures.tableCount).toBe(1);
		expect(measures.headingCount).toBe(5);
		expect(measures.paragraphRuns).toBe(0);
		expect(measures.longestParagraphSentences).toBe(1);
		expect(measures.lineCount).toBe(14);
		expect(measures.hasTroubleshooting).toBe(true);
		expect(measures.relatedPageLinkCount).toBe(2);
	});
});

describe('DocumentationJudge.parseAnswer', () => {
	it('reads the JSON inside a code fence with text around it', () => {
		const answer = DocumentationJudge.parseAnswer(buildAnswer(['a.md'], 4));
		expect(answer.pages[0].scores.usefulness).toBe(4);
	});

	it('rejects scores without matching evidence and rejects an old rubric', () => {
		const answer = DocumentationJudge.parseAnswer(buildAnswer(['a.md'], 4));
		answer.pages[0].findings = [];
		expect(() => DocumentationJudge.parseAnswer(JSON.stringify(answer))).toThrow('expected 5');
		expect(() => DocumentationJudge.parseAnswer(buildAnswer(['a.md'], 5).replace('"rubricVersion":"3"', '"rubricVersion":"1"')))
			.toThrow('expected shape');
	});

	it('allows suggestions without deducting points', () => {
		const answer = DocumentationJudge.parseAnswer(buildAnswer(['a.md'], 5));
		expect(answer.pages[0].scores.accuracy).toBe(5);
	});

	it('throws a clear error when a score is out of the scale', () => {
		expect(() => {
			DocumentationJudge.parseAnswer(buildAnswer(['a.md'], 7));
		}).toThrow('does not have the expected shape');
	});

	it('throws a clear error when the answer holds no JSON', () => {
		expect(() => {
			DocumentationJudge.parseAnswer('I cannot judge.');
		}).toThrow('holds no JSON object');
	});
});

describe('DocumentationJudge.run', () => {
	afterEach(() => {
		TestRepository.removeAll();
	});

	const createRepository = (): string => {
		const repositoryPath = TestRepository.create();
		const folder = DocumentationPaths.documentationFolder;
		TestRepository.commitFile(repositoryPath, `${folder}/files.md`, WALL_PAGE, 'Add the wall page');
		TestRepository.commitFile(repositoryPath, `${folder}/copy_a_file_path.md`, GOOD_PAGE, 'Add the good page');
		TestRepository.commitFile(repositoryPath, `${folder}/shortcuts.md`, '# Keyboard shortcuts\n', 'Add shortcuts');
		TestRepository.commitFile(repositoryPath, DocumentationPaths.sidebarConfigFile, 'export default {};\n', 'Sidebar');
		return repositoryPath;
	};

	it('puts every generated page, its measures, and the sidebar in the prompt of a dry run, but not the shortcuts', async () => {
		const repositoryPath = createRepository();
		const result = await DocumentationJudge.run({
			repositoryPath,
			agentName: 'claude',
			onlyPageFiles: [],
			isDryRun: true,
			runAgentFn: () => {
				throw new Error('The coding agent must not run in a dry run.');
			},
		});
		expect(result.judgement).toBeNull();
		expect(result.prompt).toContain('### Page `files.md`');
		expect(result.prompt).toContain('### Page `copy_a_file_path.md`');
		expect(result.prompt).toContain('"longestParagraphSentences":5');
		expect(result.prompt).toContain('export default {};');
		expect(result.prompt).not.toContain('### Page `shortcuts.md`');
	});

	it('runs the coding agent with no edit, and computes the mean scores', async () => {
		const repositoryPath = createRepository();
		const editFlags: boolean[] = [];
		const settings: unknown[] = [];
		const result = await DocumentationJudge.run({
			repositoryPath,
			agentName: 'claude',
			onlyPageFiles: [],
			isDryRun: false,
			runAgentFn: async (_prompt, _agentName, _repositoryPath, _onProgress, isEditAllowed, model, effort) => {
				settings.push([model, effort]);
				editFlags.push(isEditAllowed);
				return buildAnswer(['copy_a_file_path.md', 'files.md'], 3);
			},
		});
		expect(editFlags).toEqual([false]);
		expect(settings).toEqual([['claude-sonnet-5-5', 'high']]);
		expect(result.judgement?.evaluation.rubricVersion).toBe('3');
		expect(result.judgement?.evaluation.model).toBe('claude-sonnet-5-5');
		expect(result.judgement?.pages.map((page) => page.file)).toEqual(['copy_a_file_path.md', 'files.md']);
		expect(result.judgement?.pages[0].meanScore).toBe(3);
		expect(result.judgement?.overallScore).toBe(3);
		const report = DocumentationJudge.renderReport(result.judgement!);
		expect(report).toContain('# Judgement of the documentation: 3.0 out of 5');
		expect(report).toContain('| files.md | how-to | 3.0 |');
		expect(report).toContain('| yes | 2 links |');
		expect(report).toContain('- Merge steps 2 and 3.');
	});

	it('judges only the pages of --only', async () => {
		const repositoryPath = createRepository();
		const result = await DocumentationJudge.run({
			repositoryPath,
			agentName: 'claude',
			onlyPageFiles: ['copy_a_file_path.md'],
			isDryRun: true,
		});
		expect(result.prompt).toContain('### Page `copy_a_file_path.md`');
		expect(result.prompt).not.toContain('### Page `files.md`');
		expect(result.prompt).toContain('The Introduction, other unselected pages');
		expect(result.prompt).toContain('Reference pages may contain action/result lookup tables');
		expect(result.prompt).toContain('Optional editorial preferences are suggestions');
		expect(result.prompt).toContain('Inspect every referenced local image');
	});

	it('preserves explicit model and effort overrides', async () => {
		const repositoryPath = createRepository();
		const result = await DocumentationJudge.run({
			repositoryPath,
			agentName: 'claude',
			model: 'specified-model',
			effort: 'low',
			onlyPageFiles: ['files.md'],
			isDryRun: false,
			runAgentFn: async (_prompt, _agent, _root, _progress, _edit, model, effort) => {
				expect([model, effort]).toEqual(['specified-model', 'low']);
				return buildAnswer(['files.md'], 5);
			},
		});
		expect(result.judgement?.evaluation.effort).toBe('low');
	});

	it('blocks acceptance despite a high average when one accuracy finding is a blocker', () => {
		const pages = DocumentationJudge.readPages(createRepository(), ['files.md']);
		const answer = DocumentationJudge.parseAnswer(buildAnswer(['files.md'], 5));
		answer.site.navigation = 5;
		answer.site.consistency = 5;
		answer.site.findings = [];
		answer.pages[0].scores.accuracy = 2;
		answer.pages[0].findings.find((finding) => finding.criterion === 'accuracy')!.severity = 'blocker';
		const judgement = DocumentationJudge.combine(pages, answer);
		expect(judgement.overallScore).toBeGreaterThan(4.5);
		expect(judgement.reviewStatus).toBe('blocked');
		expect(DocumentationJudge.renderReport(judgement)).toContain('Review status: blocked');
	});

	it('requires review when verification limitations remain despite full scores', () => {
		const pages = DocumentationJudge.readPages(createRepository(), ['files.md']);
		const answer = DocumentationJudge.parseAnswer(buildAnswer(['files.md'], 5));
		answer.site.navigation = 5;
		answer.site.consistency = 5;
		answer.site.findings = [];
		answer.limitations = ['Runtime clipboard permissions were not verified.'];
		expect(DocumentationJudge.combine(pages, answer).reviewStatus).toBe('needs_review');
	});

	it('rejects duplicate or unexpected pages', () => {
		const pages = DocumentationJudge.readPages(createRepository(), ['files.md']);
		for (const files of [['files.md', 'files.md'], ['other.md']]) {
			expect(() => DocumentationJudge.combine(pages, DocumentationJudge.parseAnswer(buildAnswer(files, 5))))
				.toThrow('duplicate or unexpected pages');
		}
	});

	it('rejects a finding that cites a nonexistent source', async () => {
		const answer = DocumentationJudge.parseAnswer(buildAnswer(['files.md'], 4));
		answer.pages[0].findings[0].source = 'missing.ts';
		answer.pages[0].findings[0].sourceEvidence = 'Claimed source behaviour.';
		await expect(DocumentationJudge.run({
			repositoryPath: createRepository(),
			agentName: 'claude',
			onlyPageFiles: ['files.md'],
			isDryRun: false,
			runAgentFn: async () => JSON.stringify(answer),
		})).rejects.toThrow('no valid repository source evidence');
	});

	it('throws when the judge forgets a page', async () => {
		const repositoryPath = createRepository();
		await expect(DocumentationJudge.run({
			repositoryPath,
			agentName: 'claude',
			onlyPageFiles: [],
			isDryRun: false,
			runAgentFn: async () => {
				return buildAnswer(['files.md'], 3);
			},
		})).rejects.toThrow('The judge gave no verdict for the page "copy_a_file_path.md".');
	});
});
