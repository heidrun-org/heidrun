import Fs from 'node:fs';
import Path from 'node:path';
import { DocumentationAgent } from './documentation_agent.ts';
import { DocumentationChecks } from './documentation_checks.ts';
import { DocumentationMeasures } from './documentation_measures.ts';
import { DocumentationPaths } from './documentation_paths.ts';
import { JUDGE_ANSWER_SCHEMA } from './documentation_judge_types.ts';
import type {
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
		const prompt = DocumentationJudge.buildPrompt(pages, sidebarText);
		if (options.isDryRun === true) {
			return {
				prompt,
				judgement: null,
			};
		}
		const onStep = options.onStep ?? (() => {});
		const modelText = `model ${options.model ?? 'from its settings'}, effort ${options.effort ?? 'from its settings'}`;
		onStep(`Judging ${pages.length} pages with the coding agent "${options.agentName}" (${modelText}).`);
		const runAgentFn = options.runAgentFn ?? DocumentationAgent.run;
		const answer = await runAgentFn(
			prompt,
			options.agentName,
			options.repositoryPath,
			options.onAgentProgress,
			false,
			options.model,
			options.effort,
		);
		return {
			prompt,
			judgement: DocumentationJudge.combine(pages, DocumentationJudge.parseAnswer(answer)),
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
	 * @returns The prompt, in Markdown.
	 */
	static buildPrompt(pages: PageToJudge[], sidebarText: string): string {
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

## How to judge

Read each page as a new user who wants to get something done. Then read the sources that the page names in its comments \`<!-- source: ... -->\` (paths relative to the root of the repository) and the glossary \`${DocumentationPaths.glossaryFile}\`, to check the facts and the words.

Give each page a score from 1 (bad) to 5 (very good) for each of these criteria:

- **taskSuccess**: a new user can do the task, or find the information, from this page alone, with no guess. When the sources show a failure that the reader can meet, the page has a section "Troubleshooting" with the symptom, the cause, the solution, and a check; a missing one lowers the score, and an invented one gives at most 2 for accuracy.
- **usefulness**: every sentence helps the reader. Filler, repeated facts, and internal details lower the score.
- **order**: the page goes in the order in which the reader needs it.
- **singleType**: the page keeps to its one page type. Steps inside a reference page, or a long description inside a how-to page, lower the score.
- **userLanguage**: the page speaks to a user, with the words of the glossary. A sentence that reads like a rule for developers lowers the score.
- **accuracy**: the sources named in the comments \`<!-- source: ... -->\` support every claim. A source can be a rule file or a code file. A claim that no named source supports gives at most 2.

Use the whole scale. A score of 5 means that you would not change anything. Calibrate with these two verdicts of the owner of the project:

- A page that was one long paragraph which restated the rule file, with defaults and edge cases, was "indigestible and useless": that is 1 for usefulness and 1 for userLanguage.
- A page with clear numbered steps, but with a mixed type and some filler sentences, was "better, but far from great": that is about 3.

For each page, list at most 3 problems, the worst first. Each problem is concrete and says what to change, for example "Steps 2 and 3 are one action; merge them". Then give one sentence of verdict.

Then judge the whole set: **navigation** (can a reader find the right page from the sidebar, and does the section "Related pages" of each page lead to the page that the reader needs next?) and **consistency** (same words, same shape, no overlap between pages), each from 1 to 5, with at most 3 problems.

## Your final answer

Answer with ONE JSON object and nothing else, with no text before or after it, in this form:

\`\`\`json
{
  "pages": [
    {
      "file": "copy_a_file_path.md",
      "scores": { "taskSuccess": 4, "usefulness": 3, "order": 4, "singleType": 5, "userLanguage": 4, "accuracy": 5 },
      "problems": ["..."],
      "verdict": "..."
    }
  ],
  "site": { "navigation": 3, "consistency": 4, "problems": ["..."] }
}
\`\`\`

Give one entry in "pages" for each page below, with the same "file".

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
	 * @returns The judgement.
	 * @throws An error when the verdict misses a page.
	 */
	static combine(pages: PageToJudge[], answer: JudgeAnswer): DocumentationJudgement {
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
		return {
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
			return [`### ${page.file} (${page.meanScore.toFixed(1)})`, '', page.verdict, '', ...problemLines].join('\n');
		});
		const siteProblemLines = judgement.site.problems.map((problem) => {
			return `- ${problem}`;
		});
		const reportText = [
			`# Judgement of the documentation: ${judgement.overallScore.toFixed(1)} out of 5`,
			'',
			...tableLines,
			'',
			`Site: navigation ${judgement.site.navigation}, consistency ${judgement.site.consistency}.`,
			'',
			...siteProblemLines,
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
