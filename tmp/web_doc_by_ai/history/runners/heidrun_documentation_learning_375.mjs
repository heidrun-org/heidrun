import Fs from 'node:fs';
import Path from 'node:path';
import ChildProcess from 'node:child_process';
import Url from 'node:url';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunDocumentationLearning375 — runs three local documentation experiments
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Runs the agreed learning experiment without the updater's Git completion steps. */
export class HeidrunDocumentationLearning375 {
	/** The existing issue worktree. */
	static root = process.cwd();
	/** Saved evidence outside the repository. */
	static output = '/Users/jetienne/.codex/visualizations/2026/10/13/01a136cd-3ef5-75e3-9a2d-0bbf5efbaea0/documentation_learning';
	/** The fixed rule used by every round. */
	static rule = 'docs/agents_rules/user_interface/sidebars/files.md';
	/** The documentation folder that the writer may change. */
	static folder = 'packages/auxiliary/website_public/docs/documentation';
	/** The sidebar file that the writer may change. */
	static config = 'packages/auxiliary/website_public/docs/.vitepress/config.ts';
	/** The original commit and branch, checked after every agent invocation. */
	static identity = '';
	/** The initial changes outside the generated documentation. */
	static status = '';
	/** The shared instructions for every external agent. */
	static instructions = '\n\n## Local learning experiment\n'
		+ 'This invocation is one pass of an experiment managed by a separate process. '
		+ 'Do not run docs:update_by_ai, docs:judge_by_ai, or another documentation writer. '
		+ 'Do not change Git branches, stage files, commit, push, or create a pull request. '
		+ 'Do not edit any source, rule, glossary, prompt, or configuration outside the permitted sidebar file. '
		+ 'Do not modify index.md, shortcuts.md, or .last_documented_commit. '
		+ 'The experiment manager runs verification and scores the pages. Use no subagents.\n';

	/**
	 * Loads the existing writer and judge, then runs a baseline and three candidates.
	 * @returns A promise that resolves when the best result has been restored.
	 */
	static async run() {
		Fs.mkdirSync(this.output, { recursive: true });
		const load = (name) => import(Url.pathToFileURL(Path.join(this.root,
			'packages/dev_tools/documentation_updater/src', `${name}.ts`)).href);
		const { DocumentationAgent } = await load('documentation_agent');
		const { DocumentationJudge } = await load('documentation_judge');
		const { DocumentationPrompt } = await load('documentation_prompt');
		const { DocumentationHints } = await load('documentation_hints');
		const { DocumentationGit } = await load('documentation_git');
		const { DocumentationChecks } = await load('documentation_checks');
		const { z } = await import(Url.pathToFileURL(Path.join(this.root,
			'packages/dev_tools/documentation_updater/node_modules/zod/index.js')).href);
		const proposalSchema = z.object({
			styleText: z.string().min(100).max(10000),
			rationale: z.string().min(1),
		});
		this.identity = this._git(['rev-parse', 'HEAD', '--abbrev-ref', 'HEAD']);
		this.status = this._outsideStatus();
		const baseline = this._snapshot();
		this._save('baseline/pages.json', baseline);
		const hints = DocumentationHints.collect(this.root, DocumentationGit.readLastDocumentedCommit(this.root));
		const outlinePrompt = DocumentationPrompt.buildOutline(hints, [this.rule]);
		const start = outlinePrompt.indexOf('## Style:');
		const end = outlinePrompt.indexOf('\n## Your final answer:', start);
		const initialStyle = outlinePrompt.slice(start, end).trim();
		this._save('baseline/style.md', initialStyle);
		const judge = async (label) => {
			const pageFiles = Object.entries(this._snapshot()).filter(([file, content]) => {
				return file.startsWith(`${this.folder}/`) && content.includes(`<!-- source: ${this.rule} -->`);
			}).map(([file]) => Path.basename(file));
			const result = await this._phase(label, () => DocumentationJudge.run({
				repositoryPath: this.root,
				agentName: 'claude',
				onlyPageFiles: pageFiles,
				isDryRun: false,
				runAgentFn: async (prompt, agent, root, progress, edit, model, effort) => {
					return DocumentationAgent.run(prompt + this.instructions, agent, root,
						this._progress(label), edit, model, effort);
				},
			}));
			this._save(`${label}/judgement.json`, result.judgement);
			this._save(`${label}/judgement.md`, DocumentationJudge.renderReport(result.judgement));
			return result.judgement;
		};
		let bestJudgement = await judge('baseline');
		let bestStyle = initialStyle;
		let bestPages = baseline;
		let bestRound = 0;
		this._save('best/pages.json', bestPages);
		this._save('best/style.md', bestStyle);
		const rounds = [];
		for (let round = 1; round <= 3; round++) {
			const label = `round_${round}`;
			this._restore(baseline);
			const proposalPrompt = [
				'Propose one revised STYLE section for the Heidrun documentation writer. Read only. Return JSON only.',
				'Use the previous verdict as evidence, not as orders. Improve how a reader completes a task.',
				'Change only style guidance. Keep source priority, scope, page types, source comments, and the judge fixed.',
				'Write general guidance that also works for other features. Do not put Files-specific facts into the style.',
				'Do not inflate pages with defaults, exact dimensions, implementation details, or invented remedies.',
				'Prefer concise complete actions, findable controls, explained terms, and useful task navigation.',
				'Keep exactly the sentences "A paragraph has at most three sentences." and',
				'"Write the steps of a task as a numbered list, with one action in each step." within the guidance.',
				'The style starts with "## Style: the pages must be easy to read". Use Markdown bullets.',
				'Answer {"styleText":"the complete replacement style section", "rationale":"why the changes help"}.',
				'Current best style:', bestStyle,
				'Fixed trial rule:', this.rule,
				'Current best judgement:', JSON.stringify(bestJudgement),
				this.instructions,
			].join('\n\n');
			const proposalAnswer = await this._phase(`${label}/proposal`, () => DocumentationAgent.run(
				proposalPrompt, 'codex', this.root, this._progress(`${label}/proposal`), false, undefined, 'high',
			));
			this._save(`${label}/proposal_answer.txt`, proposalAnswer);
			const proposal = proposalSchema.parse(JSON.parse(proposalAnswer.replace(/^```(?:json)?\s*/, '')
				.replace(/\s*```$/, '').trim()));
			this._save(`${label}/proposal.json`, proposal);
			this._save(`${label}/style.md`, proposal.styleText);
			const replaceStyle = (prompt) => prompt.replace(initialStyle, proposal.styleText);
			const outline = await this._phase(`${label}/outline`, () => DocumentationAgent.run(
				replaceStyle(outlinePrompt) + this.instructions, 'codex', this.root,
				this._progress(`${label}/outline`), false, undefined, 'high',
			));
			this._save(`${label}/outline.md`, outline);
			const writingPrompt = replaceStyle(DocumentationPrompt.buildWriting(hints, [this.rule], outline));
			const report = await this._phase(`${label}/writer`, () => DocumentationAgent.run(
				writingPrompt + this.instructions, 'codex', this.root,
				this._progress(`${label}/writer`), true, undefined, 'high',
			));
			this._save(`${label}/writer_report.md`, report);
			this._save(`${label}/pages.json`, this._snapshot());
			const problems = DocumentationChecks.checkAll(this.root);
			for (const file of [`${this.folder}/index.md`, `${this.folder}/shortcuts.md`]) {
				if (Fs.readFileSync(Path.join(this.root, file), 'utf8') !== baseline[file]) {
					problems.push(`The writer changed the protected page ${file}.`);
				}
			}
			if (problems.length > 0) {
				rounds.push({ round, accepted: false, problems });
				this._save(`${label}/checks.json`, problems);
				continue;
			}
			process.stdout.write(`${label}: page checks passed; verifying website.\n`);
			for (const command of ['test', 'build']) {
				const result = ChildProcess.spawnSync('pnpm', ['--filter', 'website_public', command], {
					cwd: this.root,
					encoding: 'utf8',
				});
				this._save(`${label}/website_${command}.txt`, result.stdout + result.stderr);
				if (result.status !== 0) {
					throw new Error(`Website ${command} failed in ${label}. See the saved output.`);
				}
			}
			const judgement = await judge(label);
			const accepted = judgement.overallScore > bestJudgement.overallScore;
			rounds.push({ round, score: judgement.overallScore, accepted, comparedWith: bestJudgement.overallScore });
			process.stdout.write(`${label}: score ${judgement.overallScore}; ${accepted ? 'accepted' : 'rejected'}.\n`);
			if (accepted === true) {
				bestJudgement = judgement;
				bestStyle = proposal.styleText;
				bestPages = this._snapshot();
				bestRound = round;
				this._save('best/pages.json', bestPages);
				this._save('best/style.md', bestStyle);
			}
			this._save('progress.json', { bestRound, bestScore: bestJudgement.overallScore, rounds });
		}
		this._restore(bestPages);
		this._save('best/style.md', bestStyle);
		this._save('best/pages.json', bestPages);
		this._save('best/judgement.json', bestJudgement);
		this._save('best/judgement.md', DocumentationJudge.renderReport(bestJudgement));
		this._save('result.json', { bestRound, bestScore: bestJudgement.overallScore, rounds });
		process.stdout.write(`Finished. Best round ${bestRound}: ${bestJudgement.overallScore}.\n`);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Reads Git without modifying repository state.
	 * @param args The read-only Git arguments.
	 * @returns The trimmed command output.
	 */
	static _git(args) {
		return ChildProcess.execFileSync('git', args, { cwd: this.root, encoding: 'utf8' }).trimEnd();
	}

	/**
	 * Records changes outside the permitted documentation paths.
	 * @returns The remaining status lines.
	 */
	static _outsideStatus() {
		return this._git(['status', '--porcelain']).split('\n').filter((line) => {
			const file = line.slice(3);
			return file.startsWith(`${this.folder}/`) === false && file !== this.config;
		}).join('\n');
	}

	/**
	 * Runs a phase and checks that the agent did not change Git or unrelated files.
	 * @param label The saved phase name.
	 * @param runFn The asynchronous action.
	 * @returns The action result.
	 */
	static async _phase(label, runFn) {
		process.stdout.write(`${label}: started.\n`);
		const heartbeat = setInterval(() => process.stdout.write(`${label}: still running.\n`), 30000);
		try {
			const result = await runFn();
			if (this._git(['rev-parse', 'HEAD', '--abbrev-ref', 'HEAD']) !== this.identity
				|| this._outsideStatus() !== this.status) {
				throw new Error(`Repository state outside the permitted pages changed during ${label}.`);
			}
			process.stdout.write(`${label}: finished.\n`);
			return result;
		} finally {
			clearInterval(heartbeat);
		}
	}

	/**
	 * Saves the complete agent progress without flooding the command output.
	 * @param label The phase name.
	 * @returns A callback that appends progress to the saved log.
	 */
	static _progress(label) {
		const file = Path.join(this.output, `${label}/agent.log`);
		Fs.mkdirSync(Path.dirname(file), { recursive: true });
		return (line) => Fs.appendFileSync(file, `${line}\n`);
	}

	/**
	 * Saves a string or a structured artifact.
	 * @param name The relative artifact name.
	 * @param value The string or structured value.
	 * @returns Nothing.
	 */
	static _save(name, value) {
		const file = Path.join(this.output, name);
		Fs.mkdirSync(Path.dirname(file), { recursive: true });
		Fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
	}

	/**
	 * Reads the flat documentation folder and sidebar into a restorable snapshot.
	 * @returns The repository-relative file names and text.
	 */
	static _snapshot() {
		/** @type {Record<string, string>} */
		const pages = {};
		for (const file of Fs.readdirSync(Path.join(this.root, this.folder))) {
			const relative = `${this.folder}/${file}`;
			if (Fs.statSync(Path.join(this.root, relative)).isFile() === false) {
				throw new Error(`Unexpected documentation subfolder: ${relative}`);
			}
			pages[relative] = Fs.readFileSync(Path.join(this.root, relative), 'utf8');
		}
		pages[this.config] = Fs.readFileSync(Path.join(this.root, this.config), 'utf8');
		return pages;
	}

	/**
	 * Restores only the generated documentation and sidebar between completed phases.
	 * @param pages The saved file names and text.
	 * @returns Nothing.
	 */
	static _restore(pages) {
		for (const file of Object.keys(this._snapshot())) {
			if (pages[file] === undefined) {
				Fs.rmSync(Path.join(this.root, file));
			}
		}
		for (const [file, text] of Object.entries(pages)) {
			Fs.writeFileSync(Path.join(this.root, file), text);
		}
	}
}

if (process.argv[1] === Url.fileURLToPath(import.meta.url)) {
HeidrunDocumentationLearning375.run().catch((error) => {
	const bestFile = Path.join(HeidrunDocumentationLearning375.output, 'best/pages.json');
	if (Fs.existsSync(bestFile) === true
		&& HeidrunDocumentationLearning375._git(['rev-parse', 'HEAD', '--abbrev-ref', 'HEAD'])
			=== HeidrunDocumentationLearning375.identity
		&& HeidrunDocumentationLearning375._outsideStatus() === HeidrunDocumentationLearning375.status) {
		HeidrunDocumentationLearning375._save('failed/pages.json', HeidrunDocumentationLearning375._snapshot());
		HeidrunDocumentationLearning375._restore(JSON.parse(Fs.readFileSync(bestFile, 'utf8')));
	}
	process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
	process.exitCode = 1;
});
}
