import type { MergedPullRequest } from 'change_log_generator';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationTypes — the data shapes shared by the files of the documentation updater
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The hints that tell the coding agent which sections of the documentation to look at first. The hints are never the
 * source of truth: the rules and the code are.
 */
export type DocumentationHintSet = {
	/** The last documented commit, read from the file `.last_documented_commit`, or null on the first run. */
	lastDocumentedCommit: string | null;
	/** The current commit, `HEAD`. */
	currentCommit: string;
	/** The pull requests merged after the last documented commit, the newest first. Empty on the first run. */
	mergedPullRequests: MergedPullRequest[];
	/** The numbers of the issues that the commits after the last documented commit fix. Empty on the first run. */
	fixedIssueNumbers: number[];
	/** The files that changed after the last documented commit, in the application and in the rules. */
	changedFiles: string[];
	/** The diff of the rule files of the user interface, or an empty text on the first run. */
	rulesDiff: string;
	/** True when `rulesDiff` was cut because it is too long. */
	isRulesDiffTruncated: boolean;
};

/**
 * The options of the method `DocumentationUpdate.run`.
 */
export type DocumentationUpdateOptions = {
	/** The root folder of the Git repository. */
	repositoryPath: string;
	/** The name of the coding agent, `claude` or `codex`. */
	agentName: string;
	/** The model of the coding agent, or undefined for the model of its own settings. */
	model?: string;
	/** The effort level of the coding agent, or undefined for the effort of its own settings. */
	effort?: string;
	/** When true, the command only prints the hints and the prompt, and changes nothing. */
	isDryRun: boolean;
	/**
	 * The rule files that limit the run, relative to the root of the repository. When the list is empty, the run is a
	 * full check. When it is not empty, the coding agent checks only the features of these rule files, and the
	 * command does not write the file `.last_documented_commit`, because the check is not full.
	 */
	onlyRuleFiles: string[];
	/** Called with one line for each step of the command, so the developer sees the progress. */
	onStep?: (message: string) => void;
	/** Called with one line each time the coding agent does something. Set only with the option `--verbose`. */
	onAgentProgress?: (message: string) => void;
	/** Runs the coding agent. When undefined, the package `raw_coding_agent_cli` runs it. */
	runAgentFn?: RunDocumentationAgentFn;
	/** Runs the tests and the build of the website. When undefined, the command runs `pnpm`. */
	verifyFn?: VerifyDocumentationFn;
};

/**
 * Runs the coding agent in the repository and returns its answer.
 * @param prompt The prompt to send.
 * @param agentName The name of the coding agent, `claude` or `codex`.
 * @param repositoryPath The folder where the coding agent runs.
 * @param onProgress Called with one line each time the coding agent does something, or undefined for none.
 * @param isEditAllowed True when the coding agent may edit files (the writing pass), false when it only reads and
 * answers (the outline pass).
 * @param model The model of the coding agent, or undefined for the model of its own settings.
 * @param effort The effort level of the coding agent, or undefined for the effort of its own settings.
 * @returns The answer of the coding agent: the outline, or the report.
 */
export type RunDocumentationAgentFn = (
	prompt: string,
	agentName: string,
	repositoryPath: string,
	onProgress: ((message: string) => void) | undefined,
	isEditAllowed: boolean,
	model: string | undefined,
	effort: string | undefined,
) => Promise<string>;

/**
 * Runs the tests of the website and the build of the website.
 * @param repositoryPath The root folder of the Git repository.
 * @returns Nothing. The function throws an error when a test or the build fails.
 */
export type VerifyDocumentationFn = (repositoryPath: string) => Promise<void>;

/**
 * The result of the method `DocumentationUpdate.run`.
 */
export type DocumentationUpdateResult = {
	/** The text that the command prints: the report and the outline, or the two prompts in a dry run. */
	report: string;
};
