import Fs from 'node:fs';
import Path from 'node:path';
import ChildProcess from 'node:child_process';
import Url from 'node:url';
import { HeidrunDocumentationLearning375 } from './heidrun_documentation_learning_375.mjs';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunDocumentationModelComparison375 — compares models with one frozen prompt
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Compares the approved top model with less expensive settings on the same trial. */
export class HeidrunDocumentationModelComparison375 extends HeidrunDocumentationLearning375 {
	/** The artifacts of the model comparison. */
	static output = Path.join(HeidrunDocumentationLearning375.output, 'comparison');
	/** The fixed inputs saved before the learning rounds. */
	static baseline = {};
	/** The frozen style selected by the learning rounds. */
	static style = '';
	/** The original style section used to replace the prompt text. */
	static originalStyle = '';
	/** The settings and measurements of the completed comparison runs. */
	static results = [];

	/**
	 * Runs the reference and cheaper settings, then repeats a promising setting.
	 * @returns A promise that resolves when the preferred result is restored.
	 */
	static async run() {
		const evidence = HeidrunDocumentationLearning375.output;
		this.baseline = JSON.parse(Fs.readFileSync(Path.join(evidence, 'baseline/pages.json'), 'utf8'));
		this.style = Fs.readFileSync(Path.join(evidence, 'best/style.md'), 'utf8');
		this.originalStyle = Fs.readFileSync(Path.join(evidence, 'baseline/style.md'), 'utf8');
		this.identity = this._git(['rev-parse', 'HEAD', '--abbrev-ref', 'HEAD']);
		this.status = this._outsideStatus();
		this._save('fixed_style.md', this.style);
		this._save('before/pages.json', this._snapshot());
		const progressFile = Path.join(this.output, 'progress.json');
		if (Fs.existsSync(progressFile) === true) {
			this.results = JSON.parse(Fs.readFileSync(progressFile, 'utf8'));
		}
		const settings = [
			{ label: 'sol_high', model: 'gpt-6.1-sol', effort: 'high' },
			{ label: 'sol_medium', model: 'gpt-6.1-sol', effort: 'medium' },
			{ label: 'luna_high', model: 'gpt-6-luna', effort: 'high' },
			{ label: 'luna_medium', model: 'gpt-6-luna', effort: 'medium' },
		];
		for (const setting of settings) {
			if (this.results.some((result) => result.label === setting.label) === false) {
				await this._compare(setting);
			}
		}
		const learningJudgement = JSON.parse(Fs.readFileSync(Path.join(evidence, 'best/judgement.json'), 'utf8'));
		const learning = {
			label: 'learning_round_1',
			model: 'gpt-6-luna',
			effort: 'high',
			score: learningJudgement.overallScore,
			minimumAccuracy: Math.min(...learningJudgement.pages.map((page) => page.scores.accuracy)),
			minimumTaskSuccess: Math.min(...learningJudgement.pages.map((page) => page.scores.taskSuccess)),
		};
		const qualityReference = Math.max(learning.score, ...this.results.map((result) => result.score));
		const preference = ['luna_medium', 'luna_high', 'sol_medium', 'sol_high'];
		const candidate = preference.map((label) => this.results.find((result) => result.label === label))
			.find((result) => result.score >= qualityReference - 0.15
				&& result.minimumAccuracy >= 4 && result.minimumTaskSuccess >= 4)
			?? [learning, ...this.results].sort((first, second) => second.score - first.score)[0];
		const repeatLabel = `${candidate.model === 'gpt-6-luna' ? 'luna' : 'sol'}_${candidate.effort}_repeat`;
		if (this.results.some((result) => result.label === repeatLabel) === false) {
			await this._compare({
				label: repeatLabel,
				model: candidate.model,
				effort: candidate.effort,
			});
		}
		const repeated = this.results.find((result) => result.label === repeatLabel);
		const finalReference = Math.max(learning.score, ...this.results.map((result) => result.score));
		const isConfirmed = [candidate, repeated].every((result) => result.score >= finalReference - 0.15
			&& result.minimumAccuracy >= 4 && result.minimumTaskSuccess >= 4);
		const selected = isConfirmed === true ? repeated
			: [learning, ...this.results].sort((first, second) => second.score - first.score)[0];
		const savedPages = selected.label === learning.label ? Path.join(evidence, 'best/pages.json')
			: Path.join(this.output, selected.label, 'pages.json');
		const pages = JSON.parse(Fs.readFileSync(savedPages, 'utf8'));
		this._restore(pages);
		this._save('result.json', {
			results: this.results,
			selected: selected.label,
			isConfirmed,
			qualityReference: finalReference,
			selectionRule: 'Within 0.15 of the best observed score, with every accuracy and task-success score at least 4; '
				+ 'a promising setting is repeated. This is a provisional suggestion for human review.',
		});
		process.stdout.write(`Comparison finished. Provisional selection: ${selected.label}.\n`);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Generates and judges one result from identical starting files.
	 * @param setting The label, exact model identifier, and reasoning effort.
	 * @returns A promise that resolves after the result and evidence are saved.
	 */
	static async _compare(setting) {
		const load = (name) => import(Url.pathToFileURL(Path.join(this.root,
			'packages/dev_tools/documentation_updater/src', `${name}.ts`)).href);
		const { DocumentationAgent } = await load('documentation_agent');
		const { DocumentationJudge } = await load('documentation_judge');
		const { DocumentationPrompt } = await load('documentation_prompt');
		const { DocumentationHints } = await load('documentation_hints');
		const { DocumentationGit } = await load('documentation_git');
		const { DocumentationChecks } = await load('documentation_checks');
		const { label, model, effort } = setting;
		const savedCandidate = Path.join(this.output, label, 'pages.json');
		const isResuming = Fs.existsSync(savedCandidate) === true;
		let generationSeconds;
		if (isResuming === true) {
			this._restore(JSON.parse(Fs.readFileSync(savedCandidate, 'utf8')));
			const logFile = Path.join(this.output, label, 'outline/agent.log');
			const started = /\d{4}-\d\d-\d\dT[\d:.]+Z/.exec(Fs.readFileSync(logFile, 'utf8'))[0];
			generationSeconds = (Fs.statSync(Path.join(this.output, label, 'writer/agent.log')).mtimeMs
				- Date.parse(started)) / 1000;
			process.stdout.write(`${label}: restored saved candidate; retrying only the judge.\n`);
		} else {
			this._restore(this.baseline);
			const hints = DocumentationHints.collect(this.root, DocumentationGit.readLastDocumentedCommit(this.root));
			const replaceStyle = (prompt) => prompt.replace(this.originalStyle, this.style);
			const generationStarted = Date.now();
			const outline = await this._phase(`${label}/outline`, () => DocumentationAgent.run(
				replaceStyle(DocumentationPrompt.buildOutline(hints, [this.rule])) + this.instructions,
				'codex', this.root, this._progress(`${label}/outline`), false, model, effort,
			));
			this._save(`${label}/outline.md`, outline);
			const report = await this._phase(`${label}/writer`, () => DocumentationAgent.run(
				replaceStyle(DocumentationPrompt.buildWriting(hints, [this.rule], outline)) + this.instructions,
				'codex', this.root, this._progress(`${label}/writer`), true, model, effort,
			));
			generationSeconds = (Date.now() - generationStarted) / 1000;
			this._save(`${label}/writer_report.md`, report);
		}
		const pages = this._snapshot();
		this._save(`${label}/pages.json`, pages);
		const problems = DocumentationChecks.checkAll(this.root);
		for (const [file, content] of Object.entries(this.baseline)) {
			if (file !== this.config && content.includes(`<!-- source: ${this.rule} -->`) === false
				&& pages[file] !== content) {
				problems.push(`The writer changed a protected file: ${file}.`);
			}
		}
		if (problems.length > 0) {
			this._save(`${label}/checks.json`, problems);
			throw new Error(`Page checks failed for ${label}. See the saved evidence.`);
		}
		for (const command of ['test', 'build']) {
			if (isResuming === true && Fs.existsSync(Path.join(this.output, label, `website_${command}.txt`)) === true) {
				continue;
			}
			const result = ChildProcess.spawnSync('pnpm', ['--filter', 'website_public', command], {
				cwd: this.root,
				encoding: 'utf8',
			});
			this._save(`${label}/website_${command}.txt`, result.stdout + result.stderr);
			if (result.status !== 0) {
				throw new Error(`Website ${command} failed for ${label}. See the saved evidence.`);
			}
		}
		const pageFiles = Object.entries(pages).filter(([file, content]) => {
			return file.startsWith(`${this.folder}/`) && content.includes(`<!-- source: ${this.rule} -->`);
		}).map(([file]) => Path.basename(file));
		const judged = await this._phase(`${label}/judge`, () => DocumentationJudge.run({
			repositoryPath: this.root,
			agentName: 'claude',
			onlyPageFiles: pageFiles,
			isDryRun: false,
			runAgentFn: async (prompt, agent, root, progress, edit, judgeModel, judgeEffort) => {
				const answer = await DocumentationAgent.run(prompt + this.instructions, agent, root,
					this._progress(`${label}/judge`), edit, judgeModel, judgeEffort);
				this._save(`${label}/judge_answer.txt`, answer);
				try {
					DocumentationJudge.parseAnswer(answer);
					return answer;
				} catch {
					const repaired = this._removeTrailingCommas(answer);
					DocumentationJudge.parseAnswer(repaired);
					this._save(`${label}/judge_format_repair.json`, {
						reason: 'Removed commas before closing braces or brackets outside strings; scores unchanged.',
						answer: repaired,
					});
					return repaired;
				}
			},
		}));
		if (JSON.stringify(this._snapshot()) !== JSON.stringify(pages)) {
			throw new Error(`The judge changed documentation during ${label}.`);
		}
		this._save(`${label}/judgement.json`, judged.judgement);
		this._save(`${label}/judgement.md`, DocumentationJudge.renderReport(judged.judgement));
		const tokenCounts = ['outline', 'writer'].map((phase) => {
			const log = Fs.readFileSync(Path.join(this.output, label, phase, 'agent.log'), 'utf8');
			const count = /tokens used\s*\n([\d,]+)/.exec(log)?.[1];
			return count === undefined ? null : Number(count.replaceAll(',', ''));
		});
		const result = {
			label,
			model,
			effort,
			score: judged.judgement.overallScore,
			minimumAccuracy: Math.min(...judged.judgement.pages.map((page) => page.scores.accuracy)),
			minimumTaskSuccess: Math.min(...judged.judgement.pages.map((page) => page.scores.taskSuccess)),
			generationSeconds,
			isGenerationTimeEstimated: isResuming,
			reportedGenerationTokens: tokenCounts.every((count) => count !== null)
				? tokenCounts.reduce((total, count) => total + count, 0) : null,
			pageCount: pageFiles.length,
		};
		this.results.push(result);
		this._save(`${label}/metrics.json`, result);
		this._save('progress.json', this.results);
		process.stdout.write(`${label}: score ${result.score}; generation ${generationSeconds.toFixed(1)} seconds.\n`);
	}

	/**
	 * Removes trailing commas from JSON without changing the content of strings.
	 * @param answer The raw answer, possibly enclosed in a Markdown code fence.
	 * @returns JSON text ready for the existing strict parser and schema validation.
	 */
	static _removeTrailingCommas(answer) {
		const text = answer.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
		let isString = false;
		let isEscaped = false;
		let result = '';
		for (let index = 0; index < text.length; index++) {
			const character = text[index];
			if (isString === true) {
				result += character;
				if (isEscaped === true) {
					isEscaped = false;
				} else if (character === '\\') {
					isEscaped = true;
				} else if (character === '"') {
					isString = false;
				}
				continue;
			}
			if (character === '"') {
				isString = true;
			}
			if (character === ',') {
				let next = index + 1;
				while (/\s/.test(text[next] ?? '') === true) {
					next++;
				}
				if (text[next] === '}' || text[next] === ']') {
					continue;
				}
			}
			result += character;
		}
		return result;
	}
}

if (process.argv[1] === Url.fileURLToPath(import.meta.url)) {
HeidrunDocumentationModelComparison375.run().catch((error) => {
	const saved = Path.join(HeidrunDocumentationModelComparison375.output, 'before/pages.json');
	if (Fs.existsSync(saved) === true
		&& HeidrunDocumentationModelComparison375._git(['rev-parse', 'HEAD', '--abbrev-ref', 'HEAD'])
			=== HeidrunDocumentationModelComparison375.identity
		&& HeidrunDocumentationModelComparison375._outsideStatus() === HeidrunDocumentationModelComparison375.status) {
		HeidrunDocumentationModelComparison375._save('failed/pages.json',
			HeidrunDocumentationModelComparison375._snapshot());
		HeidrunDocumentationModelComparison375._restore(JSON.parse(Fs.readFileSync(saved, 'utf8')));
	}
	process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
	process.exitCode = 1;
});
}
