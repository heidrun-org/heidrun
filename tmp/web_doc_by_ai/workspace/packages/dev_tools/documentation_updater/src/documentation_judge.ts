import Fs from 'node:fs';
import Path from 'node:path';
import { DocumentationAgent } from './documentation_agent.ts';
import { DocumentationChecks } from './documentation_checks.ts';
import { DocumentationMeasures } from './documentation_measures.ts';
import { DocumentationPaths } from './documentation_paths.ts';
import { DocumentationJudgeRubric } from './documentation_judge_rubric.ts';
import { JUDGE_ANSWER_SCHEMA } from './documentation_judge_types.ts';
import type {
	DocumentationEvaluation,
	DocumentationJudgeOptions,
	DocumentationJudgement,
	JudgeAnswer,
	PageJudgement,
	PageMeasures,
	PageScores,
} from './documentation_judge_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationJudge — scores the quality of the generated documentation pages
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * One page to judge: its file name, its text, and its mechanical measures.
 */
type PageToJudge = {
	/** The path of the page, relative to the documentation folder, for example `copy_a_file_path.md`. */
	file: string;
	/** The Markdown text of the page. */
	text: string;
	/** The mechanical measures of the page. */
	measures: PageMeasures;
};

/**
 * Runs the command `pnpm docs:judge_by_ai`: measures each generated page, asks a coding agent to score each page
 * with a rubric, and gives a report. The judge reads the pages and the rule files, and edits no file.
 */
export class DocumentationJudge {
	/**
	 * The coding agent that judges when the option `--agent` is missing. It differs from the default writer `codex`,
	 * so the judge does not praise its own style.
	 */
	static readonly defaultAgentName = 'claude';

	/** The fixed Claude model resolved from the actual local Sonnet setting. */
	static readonly defaultClaudeModel = 'claude-sonnet-5-5';

	/** The explicit effort of the default Claude evaluation. */
	static readonly defaultClaudeEffort = 'high';

	/**
	 * Judges the generated pages.
	 * @param options The folder of the repository, the coding agent, and the pages to judge.
	 * @returns The prompt of the judge, and the judgement, which is null in a dry run.
	 * @throws An error when there is no page to judge, when the coding agent fails, or when its answer is not the
	 * expected JSON.
	 */
	static async run(
		options: DocumentationJudgeOptions,
	): Promise<{ prompt: string; judgement: DocumentationJudgement | null }> {
		const pages = DocumentationJudge.readPages(options.repositoryPath, options.onlyPageFiles);
		if (pages.length === 0) {
			throw new Error('There is no generated page to judge. Run pnpm docs:update_by_ai first.');
		}
		const sidebarText = Fs.readFileSync(Path.join(options.repositoryPath, DocumentationPaths.sidebarConfigFile), 'utf8');
		const isLimitedRun = options.onlyPageFiles.length > 0;
		const prompt = DocumentationJudge.buildPrompt(pages, sidebarText, isLimitedRun);
		const model = options.model ?? (options.agentName === 'claude' ? DocumentationJudge.defaultClaudeModel : undefined);
		const effort = options.effort ?? (options.agentName === 'claude' ? DocumentationJudge.defaultClaudeEffort : undefined);
		if (options.isDryRun === true) {
			return {
				prompt,
				judgement: null,
			};
		}
		const onStep = options.onStep ?? (() => {});
		const modelText = `model ${model ?? 'from its settings'}, effort ${effort ?? 'from its settings'}`;
		onStep(`Judging ${pages.length} pages with the coding agent "${options.agentName}" (${modelText}).`);
		const runAgentFn = options.runAgentFn ?? DocumentationAgent.run;
		const answer = await runAgentFn(
			prompt,
			options.agentName,
			options.repositoryPath,
			options.onAgentProgress,
			false,
			model,
			effort,
		);
		const parsedAnswer = DocumentationJudge.parseAnswer(answer);
		DocumentationJudge._checkFindingSources(options.repositoryPath, parsedAnswer);
		return {
			prompt,
			judgement: DocumentationJudge.combine(pages, parsedAnswer, {
				rubricVersion: DocumentationJudgeRubric.version,
				isLimitedRun,
				pageFiles: pages.map((page) => page.file),
				agentName: options.agentName,
				model: model ?? null,
				effort: effort ?? null,
			}),
		};
	}

	/**
	 * Reads the generated pages and measures them. The page of the shortcuts is not judged, because a script writes it.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param onlyPageFiles The file names of the pages to judge, or an empty list for all the generated pages.
	 * @returns The pages, with their text and their measures.
	 * @throws An error when a page of `onlyPageFiles` is not a generated page.
	 */
	static readPages(repositoryPath: string, onlyPageFiles: string[]): PageToJudge[] {
		const documentationPath = Path.join(repositoryPath, DocumentationPaths.documentationFolder);
		const pages = DocumentationChecks.listGeneratedPages(repositoryPath).map((pagePath) => {
			const text = Fs.readFileSync(pagePath, 'utf8');
			return {
				file: Path.relative(documentationPath, pagePath),
				text,
				measures: DocumentationMeasures.measure(text),
			};
		});
		if (onlyPageFiles.length === 0) {
			return pages;
		}
		const wantedFiles = onlyPageFiles.map((pageFile) => {
			return Path.basename(pageFile);
		});
		for (const wantedFile of wantedFiles) {
			const isFound = pages.some((page) => {
				return page.file === wantedFile;
			});
			if (isFound === false) {
				throw new Error(`The page "${wantedFile}" is not a generated page of ${DocumentationPaths.documentationFolder}.`);
			}
		}
		return pages.filter((page) => {
			return wantedFiles.includes(page.file);
		});
	}

	/**
	 * Builds the prompt of the judge.
	 * @param pages The pages to judge, with their text and their measures.
	 * @param sidebarText The text of the VitePress configuration, which holds the sidebar.
	 * @param isLimitedRun True when only selected pages are scored; other pages remain outside scope.
	 * @returns The prompt, in Markdown.
	 */
	static buildPrompt(pages: PageToJudge[], sidebarText: string, isLimitedRun = false): string {
		const pageTexts = pages.map((page) => {
			return [
				`### Page \`${page.file}\``,
				'',
				`Measures: ${JSON.stringify(page.measures)}`,
				'',
				'````markdown',
				page.text.trim(),
				'````',
			].join('\n');
		});
		const promptText = /* markdown */ `
You judge the user documentation of the application Heidrun, as a strict and experienced technical writer. You run inside the Git repository of Heidrun. DO NOT edit any file: you only read, and you answer with JSON.

The pages are for a person who uses Heidrun, not for a developer. Each page must have one page type of the Diátaxis framework (https://diataxis.fr), named in its comment \`<!-- page type: ... -->\`:

- **tutorial**: a lesson for a new user, with a short path of steps to a first success.
- **how-to**: the steps that solve one task of a person who already uses Heidrun.
- **reference**: a dry description to look up, mostly tables.
- **explanation**: why a feature works the way it does.

## Evaluation scope

Selected pages: ${pages.map((page) => page.file).join(', ')}.

${isLimitedRun === true
	? 'This is a LIMITED feature evaluation. Score only the selected pages and their findability in the sidebar. The Introduction, other unselected pages, absence of a site-wide tutorial, and unrelated features are outside scope and cannot reduce any score. Put any such observations in limitations, not findings or problems. A limited set does not need every Diátaxis page type. Existing linked prerequisites can be read for context, but do not demand editing unselected pages.'
	: 'This is a full evaluation of the supplied generated pages. Judge the site only within the documentation that this command owns.'}

Read the sources named in each page and the glossary. Inspect referenced screenshots from packages/auxiliary/website_public/docs/public when evaluating their pixels. Follow the fixed contract below; mechanical measures are context, not automatic penalties.

${DocumentationJudgeRubric.buildText()}

## Your final answer

Answer with ONE JSON object and no text outside it. Use rubricVersion "${DocumentationJudgeRubric.version}". Return exactly one entry for each selected page. Every score below 5 must have evidence with matching severity for that criterion; the parser rejects scores that disagree with evidence. Findings with severity suggestion do not reduce scores. At most 18 findings and 3 problem summaries per page; at most 8 findings and 3 summaries for the set. Limitations and outside-scope observations do not affect scores.

A finding has these fields: criterion, severity, location, evidence, impact, source (relative file path or null), sourceEvidence (source excerpt/observed behaviour or null), recommendation. Page criteria are taskSuccess, usefulness, order, singleType, userLanguage, accuracy. Set criteria are navigation and consistency. Use a source and sourceEvidence for source-dependent claims; uncertainty is not a verified finding. Problem summaries must summarise the verified findings, not introduce new requirements.

Shape (a page meeting all requirements may have scores of 5 and no findings):

\`\`\`json
{
  "rubricVersion": "${DocumentationJudgeRubric.version}",
  "pages": [
    {
      "file": "copy_a_file_path.md",
      "scores": { "taskSuccess": 5, "usefulness": 5, "order": 5, "singleType": 5, "userLanguage": 5, "accuracy": 5 },
      "findings": [],
      "problems": [],
      "verdict": "The task is achievable and the supporting information is accurate."
    }
  ],
  "site": { "navigation": 5, "consistency": 5, "findings": [], "problems": [] },
  "limitations": []
}
\`\`\`

Git history is read only: never stage, change branches, commit, push, create a pull request, or merge. Do not run writers, edit files, or use subagents.

## The sidebar

\`\`\`ts
${sidebarText.trim()}
\`\`\`

## The pages

${pageTexts.join('\n\n')}
`;
		return promptText.trim();
	}

	/**
	 * Reads the answer of the judge: the JSON object, with or without a code fence, and with or without text around.
	 * @param answer The answer of the coding agent.
	 * @returns The verdict, checked with its schema.
	 * @throws An error when the answer holds no JSON object, or when the object does not match the schema.
	 */
	static parseAnswer(answer: string): JudgeAnswer {
		const startIndex = answer.indexOf('{');
		const endIndex = answer.lastIndexOf('}');
		if (startIndex === -1 || endIndex < startIndex) {
			throw new Error(`The answer of the judge holds no JSON object:\n${answer}`);
		}
		let value: unknown;
		try {
			value = JSON.parse(answer.slice(startIndex, endIndex + 1));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`The answer of the judge is not valid JSON (${message}):\n${answer}`);
		}
		const result = JUDGE_ANSWER_SCHEMA.safeParse(value);
		if (result.success === false) {
			throw new Error(`The answer of the judge does not have the expected shape:\n${result.error.message}`);
		}
		return result.data;
	}

	/**
	 * Puts the verdict of the judge and the measures together, and computes the mean scores.
	 * @param pages The judged pages, with their measures.
	 * @param answer The verdict of the judge.
	 * @param evaluation The recorded scope and settings, or undefined for a manually combined answer.
	 * @returns The judgement.
	 * @throws An error when the verdict misses a page.
	 */
	static combine(
		pages: PageToJudge[],
		answer: JudgeAnswer,
		evaluation?: DocumentationEvaluation,
	): DocumentationJudgement {
		const answerFiles = answer.pages.map((page) => page.file);
		if (new Set(answerFiles).size !== answerFiles.length
			|| answerFiles.some((file) => pages.some((page) => page.file === file) === false)) {
			throw new Error('The judge returned duplicate or unexpected pages.');
		}
		const pageJudgements: PageJudgement[] = pages.map((page) => {
			const verdict = answer.pages.find((answerPage) => {
				return Path.basename(answerPage.file) === Path.basename(page.file);
			});
			if (verdict === undefined) {
				throw new Error(`The judge gave no verdict for the page "${page.file}".`);
			}
			return {
				...verdict,
				file: page.file,
				measures: page.measures,
				meanScore: DocumentationJudge._mean(Object.values(verdict.scores)),
			};
		});
		const pageMeans = pageJudgements.map((pageJudgement) => {
			return pageJudgement.meanScore;
		});
		const findings = [...answer.pages.flatMap((page) => page.findings), ...answer.site.findings];
		const hasBlockingFinding = findings.some((finding) => {
			return finding.severity === 'blocker' || finding.severity === 'unusable';
		});
		const hasDeduction = findings.some((finding) => {
			return finding.severity !== 'suggestion';
		});
		return {
			reviewStatus: hasBlockingFinding === true ? 'blocked'
				: hasDeduction === true || answer.limitations.length > 0 ? 'needs_review' : 'no_verified_defect',
			evaluation: evaluation ?? {
				rubricVersion: DocumentationJudgeRubric.version,
				isLimitedRun: false,
				pageFiles: pages.map((page) => page.file),
				agentName: null,
				model: null,
				effort: null,
			},
			limitations: answer.limitations,
			pages: pageJudgements,
			site: answer.site,
			overallScore: DocumentationJudge._mean([...pageMeans, answer.site.navigation, answer.site.consistency]),
		};
	}

	/**
	 * Writes the judgement as a Markdown report for a person.
	 * @param judgement The judgement.
	 * @returns The report, in Markdown.
	 */
	static renderReport(judgement: DocumentationJudgement): string {
		const scoreNames: (keyof PageScores)[] = ['taskSuccess', 'usefulness', 'order', 'singleType', 'userLanguage', 'accuracy'];
		const tableLines = [
			`| Page | Type | Mean | ${scoreNames.join(' | ')} | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |`,
			`| --- | --- | --- | ${scoreNames.map(() => '---').join(' | ')} | --- | --- | --- | --- | --- |`,
			...judgement.pages.map((page) => {
				const scores = scoreNames.map((scoreName) => {
					return String(page.scores[scoreName]);
				});
				const measures = page.measures;
				return `| ${page.file} | ${measures.pageType ?? 'none'} | ${page.meanScore.toFixed(1)} | ${scores.join(' | ')} `
					+ `| ${measures.lineCount} | ${measures.longestParagraphSentences} sentences | ${measures.paragraphRuns} `
					+ `| ${measures.hasTroubleshooting ? 'yes' : 'no'} | ${measures.relatedPageLinkCount} links |`;
			}),
		];
		const pageSections = judgement.pages.map((page) => {
			const problemLines = page.problems.map((problem) => {
				return `- ${problem}`;
			});
			const evidenceLines = page.findings.map((finding) => {
				const sourceText = finding.source === null ? '' : ` Source: ${finding.source}. ${finding.sourceEvidence ?? ''}`;
				return `- ${finding.criterion} / ${finding.severity} / ${finding.location}: ${finding.evidence} `
					+ `Impact: ${finding.impact}.${sourceText} Recommendation: ${finding.recommendation}`;
			});
			return [
				`### ${page.file} (${page.meanScore.toFixed(1)})`, '', page.verdict, '', ...problemLines,
				'', 'Evidence:', '', ...evidenceLines,
			].join('\n');
		});
		const siteProblemLines = judgement.site.problems.map((problem) => {
			return `- ${problem}`;
		});
		const reportText = [
			`# Judgement of the documentation: ${judgement.overallScore.toFixed(1)} out of 5`,
			'',
			`Review status: ${judgement.reviewStatus}. The average is diagnostic and does not certify acceptance.`,
			'',
			`Rubric ${judgement.evaluation.rubricVersion}; scope: `
				+ `${judgement.evaluation.isLimitedRun === true ? 'selected pages' : 'full set'}; `
				+ `agent: ${judgement.evaluation.agentName ?? 'unrecorded'}; `
				+ `model: ${judgement.evaluation.model ?? 'unrecorded'}; `
				+ `effort: ${judgement.evaluation.effort ?? 'unrecorded'}.`,
			'',
			...tableLines,
			'',
			`Site: navigation ${judgement.site.navigation}, consistency ${judgement.site.consistency}.`,
			'',
			...siteProblemLines,
			'',
			...judgement.site.findings.map((finding) => {
				return `- Evidence (${finding.criterion}, ${finding.severity}, ${finding.location}): `
					+ `${finding.evidence} Impact: ${finding.impact}. Recommendation: ${finding.recommendation}`;
			}),
			'',
			'Limitations and outside-scope observations (not scored):',
			'',
			...judgement.limitations.map((limitation) => `- ${limitation}`),
			'',
			...pageSections.flatMap((pageSection) => {
				return [pageSection, ''];
			}),
		];
		return reportText.join('\n').trim();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Rejects invented or external source paths in findings.
	 * @param repositoryPath The evaluated worktree.
	 * @param answer The parsed judge answer.
	 * @returns Nothing when all supplied sources exist inside the repository.
	 */
	private static _checkFindingSources(repositoryPath: string, answer: JudgeAnswer): void {
		const findings = [...answer.pages.flatMap((page) => page.findings), ...answer.site.findings];
		for (const finding of findings) {
			if (finding.source === null) {
				continue;
			}
			const sourcePath = Path.resolve(repositoryPath, finding.source);
			if (sourcePath.startsWith(`${Path.resolve(repositoryPath)}${Path.sep}`) === false
				|| Fs.existsSync(sourcePath) === false || finding.sourceEvidence === null
				|| finding.sourceEvidence.trim() === '') {
				throw new Error(`The finding has no valid repository source evidence: ${finding.source}`);
			}
		}
	}

	/**
	 * Computes the mean of a list of numbers.
	 * @param values The numbers.
	 * @returns The mean, or 0 for an empty list.
	 */
	private static _mean(values: number[]): number {
		if (values.length === 0) {
			return 0;
		}
		const total = values.reduce((sum, value) => {
			return sum + value;
		}, 0);
		return total / values.length;
	}
}
