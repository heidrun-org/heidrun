import { z } from 'zod';
import type { RunDocumentationAgentFn } from './documentation_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationJudgeTypes — the data shapes of the judge of the documentation
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The mechanical measures of one page. They need no coding agent.
 */
export type PageMeasures = {
	/** The page type of the comment `<!-- page type: ... -->`, or null when the comment is missing. */
	pageType: string | null;
	/** The number of lines with text, without the blank lines and the comments. */
	lineCount: number;
	/** The number of words, without the comments. */
	wordCount: number;
	/** The number of sentences of the longest paragraph. The style asks for at most 3. */
	longestParagraphSentences: number;
	/** The number of times a paragraph follows another paragraph with no heading, list, or table between them. */
	paragraphRuns: number;
	/** The number of lines of numbered lists. */
	numberedStepCount: number;
	/** The number of lines of bullet lists. */
	bulletCount: number;
	/** The number of tables. */
	tableCount: number;
	/** The number of headings, the title included. */
	headingCount: number;
	/** True when the page has a section `## Troubleshooting`. */
	hasTroubleshooting: boolean;
	/** The number of links in the section `## Related pages`, or 0 when the section is missing. */
	relatedPageLinkCount: number;
};

/** A score from 1 (bad) to 5 (very good). */
const SCORE_SCHEMA = z.number().int().min(1).max(5);

/**
 * The scores that the judge gives to one page. Each score goes from 1 (bad) to 5 (very good).
 */
export const PAGE_SCORES_SCHEMA = z.object({
	/** Can a new user do the task, or find the information, from this page alone? */
	taskSuccess: SCORE_SCHEMA,
	/** Does every sentence help the reader? */
	usefulness: SCORE_SCHEMA,
	/** Is the order of the page natural for the reader? */
	order: SCORE_SCHEMA,
	/** Does the page keep to its one page type of the Diátaxis framework? */
	singleType: SCORE_SCHEMA,
	/** Is the page written for a user, with the words of the glossary, and not as a rule for developers? */
	userLanguage: SCORE_SCHEMA,
	/** Do the source rule files support every claim of the page? */
	accuracy: SCORE_SCHEMA,
});

/**
 * The scores of one page, from 1 (bad) to 5 (very good).
 */
export type PageScores = z.infer<typeof PAGE_SCORES_SCHEMA>;

/**
 * The verdict of the judge on the whole set of pages and on each page. The judge answers with this JSON.
 */
export const JUDGE_ANSWER_SCHEMA = z.object({
	/** The verdict on each page. */
	pages: z.array(z.object({
		/** The file name of the page, for example `copy_a_file_path.md`. */
		file: z.string(),
		/** The scores of the page. */
		scores: PAGE_SCORES_SCHEMA,
		/** The most important problems of the page, at most 3, the worst first, each one concrete. */
		problems: z.array(z.string()).max(3),
		/** One sentence that says what the page is worth to a reader. */
		verdict: z.string(),
	})),
	/** The verdict on the whole set of pages. */
	site: z.object({
		/** Can a reader find the right page from the sidebar? From 1 (bad) to 5 (very good). */
		navigation: SCORE_SCHEMA,
		/** Do the pages use the same words, the same shape, and no overlap? From 1 (bad) to 5 (very good). */
		consistency: SCORE_SCHEMA,
		/** The most important problems of the whole set, at most 3, the worst first. */
		problems: z.array(z.string()).max(3),
	}),
});

/**
 * The verdict of the judge, as the judge answers it.
 */
export type JudgeAnswer = z.infer<typeof JUDGE_ANSWER_SCHEMA>;

/**
 * The verdict and the measures of one page.
 */
export type PageJudgement = JudgeAnswer['pages'][number] & {
	/** The mechanical measures of the page. */
	measures: PageMeasures;
	/** The mean of the six scores, from 1 to 5. */
	meanScore: number;
};

/**
 * The result of the method `DocumentationJudge.run`.
 */
export type DocumentationJudgement = {
	/** The verdict and the measures of each page. */
	pages: PageJudgement[];
	/** The verdict on the whole set of pages. */
	site: JudgeAnswer['site'];
	/** The mean of the mean scores of the pages and of the two scores of the site, from 1 to 5. */
	overallScore: number;
};

/**
 * The options of the method `DocumentationJudge.run`.
 */
export type DocumentationJudgeOptions = {
	/** The root folder of the Git repository. */
	repositoryPath: string;
	/** The name of the coding agent that judges, `claude` or `codex`. */
	agentName: string;
	/** The model of the coding agent, or undefined for the model of its own settings. */
	model?: string;
	/** The effort level of the coding agent, or undefined for the effort of its own settings. */
	effort?: string;
	/** The file names of the pages to judge, or an empty list for all the generated pages. */
	onlyPageFiles: string[];
	/** When true, the command only prints the prompt of the judge, and runs no coding agent. */
	isDryRun: boolean;
	/** Called with one line for each step of the command. */
	onStep?: (message: string) => void;
	/** Called with one line each time the coding agent does something. Set only with the option `--verbose`. */
	onAgentProgress?: (message: string) => void;
	/** Runs the coding agent. When undefined, the package `raw_coding_agent_cli` runs it, with no edit allowed. */
	runAgentFn?: RunDocumentationAgentFn;
};
