import ChildProcess from 'node:child_process';
import { DocumentationAgent } from './documentation_agent.ts';
import { DocumentationChecks } from './documentation_checks.ts';
import { DocumentationGit } from './documentation_git.ts';
import { DocumentationHints } from './documentation_hints.ts';
import { DocumentationPrompt } from './documentation_prompt.ts';
import type { DocumentationUpdateOptions, DocumentationUpdateResult } from './documentation_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationUpdate — runs the whole update of the user documentation by a coding agent
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Runs the command `pnpm docs:update_by_ai`: collects the hints, asks a coding agent to do a full check of the
 * documentation, runs the tests and the build of the website, and leaves the generated files uncommitted.
 */
export class DocumentationUpdate {
	/** The coding agent that the command uses when the option `--agent` is missing. */
	static readonly defaultAgentName = 'codex';

	/**
	 * Runs the update.
	 * @param options The folder of the repository, the coding agent, and the choices of the developer.
	 * @returns The report and the outline.
	 * @throws An error when the last documented commit is not an ancestor of
	 * `HEAD`, when the coding agent fails, when a test fails, or when the build fails.
	 */
	static async run(options: DocumentationUpdateOptions): Promise<DocumentationUpdateResult> {
		const { repositoryPath } = options;
		const lastDocumentedCommit = DocumentationGit.readLastDocumentedCommit(repositoryPath);
		const lastCommitProblems = DocumentationChecks.checkLastDocumentedCommit(repositoryPath);
		if (lastCommitProblems.length > 0) {
			throw new Error(lastCommitProblems.join('\n'));
		}
		const hints = DocumentationHints.collect(repositoryPath, lastDocumentedCommit);
		const outlinePrompt = DocumentationPrompt.buildOutline(hints, options.onlyRuleFiles);
		if (options.isDryRun === true) {
			const writingPrompt = DocumentationPrompt.buildWriting(
				hints,
				options.onlyRuleFiles,
				'(the outline that the first pass returns)',
			);
			return {
				report: `# Pass 1: the outline prompt\n\n${outlinePrompt}\n\n# Pass 2: the writing prompt\n\n${writingPrompt}`,
			};
		}
		const onStep = options.onStep ?? (() => {});
		const modelText = `model ${options.model ?? 'from its settings'}, effort ${options.effort ?? 'from its settings'}`;
		onStep(`Step 1 of 4: the coding agent "${options.agentName}" (${modelText}) plans the pages (no edit). This can take several minutes.`);
		const outline = await DocumentationUpdate._runAgentWithHeartbeat(options, outlinePrompt, false, onStep);
		onStep('Step 2 of 4: the coding agent writes the pages from the outline. This can take several minutes.');
		const writingPrompt = DocumentationPrompt.buildWriting(hints, options.onlyRuleFiles, outline);
		const agentAnswer = await DocumentationUpdate._runAgentWithHeartbeat(options, writingPrompt, true, onStep);
		const agentReport = `${agentAnswer.trim()}\n\n<details>\n<summary>The outline of the first pass</summary>\n\n${outline.trim()}\n\n</details>`;
		onStep('Step 3 of 4: testing the generated pages.');
		if (options.onlyRuleFiles.length === 0) {
			DocumentationGit.writeLastDocumentedCommit(repositoryPath, hints.currentCommit);
		}
		const problems = DocumentationChecks.checkAll(repositoryPath);
		if (problems.length > 0) {
			throw new Error(`The generated documentation breaks its rules:\n${problems.join('\n')}`);
		}
		onStep('Step 4 of 4: running the tests and the build of the website.');
		const verifyFn = options.verifyFn ?? DocumentationUpdate._runPnpmVerification;
		await verifyFn(repositoryPath);
		onStep('Generated documentation remains in the working tree, uncommitted.');
		return {
			report: agentReport,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Runs one pass of the coding agent, and prints a line every 30 seconds while it runs.
	 * @param options The options of the method `run`: the coding agent, the repository, and the callbacks.
	 * @param prompt The prompt of the pass.
	 * @param isEditAllowed True for the writing pass, false for the outline pass.
	 * @param onStep Called with each line to print.
	 * @returns The answer of the coding agent.
	 */
	private static async _runAgentWithHeartbeat(
		options: DocumentationUpdateOptions,
		prompt: string,
		isEditAllowed: boolean,
		onStep: (message: string) => void,
	): Promise<string> {
		const runAgentFn = options.runAgentFn ?? DocumentationAgent.run;
		const startTime = Date.now();
		const heartbeat = setInterval(() => {
			onStep(`  still running, ${Math.round((Date.now() - startTime) / 1000)} seconds. Use --verbose to see what it does.`);
		}, 30_000);
		try {
			return await runAgentFn(
				prompt,
				options.agentName,
				options.repositoryPath,
				options.onAgentProgress,
				isEditAllowed,
				options.model,
				options.effort,
			);
		} finally {
			clearInterval(heartbeat);
		}
	}

	/**
	 * Runs the tests of the website and the build of the website with `pnpm`, and shows their output.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns A promise that resolves when both commands pass.
	 * @throws An error when a command fails.
	 */
	private static async _runPnpmVerification(repositoryPath: string): Promise<void> {
		for (const args of [['--filter', 'website_public', 'test'], ['--filter', 'website_public', 'build']]) {
			const result = ChildProcess.spawnSync('pnpm', args, {
				cwd: repositoryPath,
				stdio: 'inherit',
			});
			if (result.status !== 0) {
				throw new Error(`The command "pnpm ${args.join(' ')}" failed.`);
			}
		}
	}
}
