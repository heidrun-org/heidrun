import { z } from 'zod';
import { DocumentationJudgeRubric } from './documentation_judge_rubric.ts';
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
	/** Can the intended reader complete the task or lookup, including clearly linked prerequisites? */
	taskSuccess: SCORE_SCHEMA,
	/** Does the content help the stated task or lookup goal? */
	usefulness: SCORE_SCHEMA,
	/** Is the order of the page natural for the reader? */
	order: SCORE_SCHEMA,
	/** Does the page keep to its one page type of the Diátaxis framework? */
	singleType: SCORE_SCHEMA,
	/** Is the page written for a user, with the words of the glossary, and not as a rule for developers? */
	userLanguage: SCORE_SCHEMA,
	/** Do factual claims match the rules, code, and actual screenshot state? */
	accuracy: SCORE_SCHEMA,
});

/**
 * The scores of one page, from 1 (bad) to 5 (very good).
 */
export type PageScores = z.infer<typeof PAGE_SCORES_SCHEMA>;

/** The six page criteria, in report order. */
export const PAGE_CRITERIA = [
	'taskSuccess', 'usefulness', 'order', 'singleType', 'userLanguage', 'accuracy',
] as const;

/** The two criteria for the selected set's navigation and consistency. */
const SITE_CRITERIA = ['navigation', 'consistency'] as const;

/** The score determined by the most severe finding for a criterion. */
export const FINDING_SCORES = {
	suggestion: 5,
	minor: 4,
	material: 3,
	blocker: 2,
	unusable: 1,
} as const;

/** Evidence needed for a deduction or an optional suggestion. */
const FINDING_SCHEMA = z.object({
	/** The severity that determines the score; suggestions never reduce a score. */
	severity: z.enum(['suggestion', 'minor', 'material', 'blocker', 'unusable']),
	/** The relevant page heading, step, image, or selected sidebar item. */
	location: z.string().min(1),
	/** The observed text or image state that supports the finding. */
	evidence: z.string().min(1),
	/** The demonstrated effect on the reader, or the optional benefit of a suggestion. */
	impact: z.string().min(1),
	/** The relative source path for a source-dependent claim, otherwise null. */
	source: z.string().nullable(),
	/** A source excerpt or observed code behaviour, otherwise null. */
	sourceEvidence: z.string().nullable(),
	/** A correction within scope, or an optional alternative for a suggestion. */
	recommendation: z.string().min(1),
});

/** The fixed-format evaluation returned by the judge. */
export const JUDGE_ANSWER_SCHEMA = z.object({
	/** The scoring contract used for this answer. */
	rubricVersion: z.literal(DocumentationJudgeRubric.version),
	/** The verdict on each selected page. */
	pages: z.array(z.object({
		/** The selected page filename. */
		file: z.string(),
		/** Scores determined by the most severe findings. */
		scores: PAGE_SCORES_SCHEMA,
		/** Evidence for all deductions, plus any optional suggestions. */
		findings: z.array(FINDING_SCHEMA.extend({
			/** The one criterion affected by this finding. */
			criterion: z.enum(PAGE_CRITERIA),
		})).max(18),
		/** A concise summary of the most important verified problems. */
		problems: z.array(z.string()).max(3),
		/** A one-sentence reader verdict. */
		verdict: z.string(),
	})),
	/** Navigation and consistency of the set inside the declared scope. */
	site: z.object({
		/** Findability of the selected pages. */
		navigation: SCORE_SCHEMA,
		/** Compatible names and instructions across the selected pages. */
		consistency: SCORE_SCHEMA,
		/** Evidence for deductions in the selected set. */
		findings: z.array(FINDING_SCHEMA.extend({
			/** The one set criterion affected by this finding. */
			criterion: z.enum(SITE_CRITERIA),
		})).max(8),
		/** A concise summary of verified set problems. */
		problems: z.array(z.string()).max(3),
	}),
	/** Limitations of the evaluation or observations outside scope; never scoring deductions. */
	limitations: z.array(z.string()).max(8),
}).superRefine((answer, context) => {
	for (const [pageIndex, page] of answer.pages.entries()) {
		for (const criterion of PAGE_CRITERIA) {
			const scores = page.findings.filter((finding) => finding.criterion === criterion)
				.map((finding) => FINDING_SCORES[finding.severity]);
			const expectedScore = Math.min(5, ...scores);
			if (page.scores[criterion] !== expectedScore) {
				context.addIssue({
					code: 'custom',
					path: ['pages', pageIndex, 'scores', criterion],
					message: `Score must match evidence severity: expected ${expectedScore}.`,
				});
			}
		}
	}
	for (const criterion of SITE_CRITERIA) {
		const scores = answer.site.findings.filter((finding) => finding.criterion === criterion)
			.map((finding) => FINDING_SCORES[finding.severity]);
		const expectedScore = Math.min(5, ...scores);
		if (answer.site[criterion] !== expectedScore) {
			context.addIssue({
				code: 'custom',
				path: ['site', criterion],
				message: `Score must match evidence severity: expected ${expectedScore}.`,
			});
		}
	}
});

/** The scope and fixed settings recorded with an evaluation. */
export type DocumentationEvaluation = {
	/** The version of the scoring requirements. */
	rubricVersion: string;
	/** True when only selected pages are scored. */
	isLimitedRun: boolean;
	/** The filenames included in the evaluation. */
	pageFiles: string[];
	/** The evaluating coding agent, or null for manually combined answers. */
	agentName: string | null;
	/** The requested fixed model, or null when unavailable. */
	model: string | null;
	/** The requested effort, or null when unavailable. */
	effort: string | null;
};

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
	/** A blocking finding prevents acceptance regardless of the average; absence of findings is not certification. */
	reviewStatus: 'blocked' | 'needs_review' | 'no_verified_defect';
	/** The evaluation scope, scoring contract, and requested model settings. */
	evaluation: DocumentationEvaluation;
	/** Evaluation limitations and outside-scope observations, excluded from scoring. */
	limitations: string[];
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
	/** The requested model; undefined uses the fixed Claude default or another agent's settings. */
	model?: string;
	/** The requested effort; undefined uses the fixed Claude default or another agent's settings. */
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
