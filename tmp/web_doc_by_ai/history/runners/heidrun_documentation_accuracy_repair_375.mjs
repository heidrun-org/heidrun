import Fs from 'node:fs';
import Path from 'node:path';
import Url from 'node:url';
import ChildProcess from 'node:child_process';
import { HeidrunDocumentationLearning375 } from './heidrun_documentation_learning_375.mjs';
import { HeidrunDocumentationModelComparison375 } from './heidrun_documentation_model_comparison_375.mjs';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunDocumentationAccuracyRepair375 — corrects one verified documentation error
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Has the approved top model correct a menu sequence after the completed benchmark. */
class HeidrunDocumentationAccuracyRepair375 extends HeidrunDocumentationLearning375 {
	/** The evidence for this accuracy repair, separate from the model comparison. */
	static output = Path.join(HeidrunDocumentationLearning375.output, 'final_repair');

	/**
	 * Asks Sol High for one corrected page, writes the validated response, and verifies it.
	 * @returns A promise that resolves after the page and its verdict are saved.
	 */
	static async run() {
		const load = (name) => import(Url.pathToFileURL(Path.join(this.root,
			'packages/dev_tools/documentation_updater/src', `${name}.ts`)).href);
		const { DocumentationAgent } = await load('documentation_agent');
		const { DocumentationChecks } = await load('documentation_checks');
		const { DocumentationJudge } = await load('documentation_judge');
		const { z } = await import(Url.pathToFileURL(Path.join(this.root,
			'packages/dev_tools/documentation_updater/node_modules/zod/index.js')).href);
		const file = `${this.folder}/change_the_files_list_appearance.md`;
		const style = Fs.readFileSync(Path.join(HeidrunDocumentationLearning375.output, 'best/style.md'), 'utf8');
		const pages = this._snapshot();
		this._save('before/pages.json', pages);
		this.identity = this._git(['rev-parse', 'HEAD', '--abbrev-ref', 'HEAD']);
		this.status = this._outsideStatus();
		const prompt = [
			'Correct exactly one generated Heidrun documentation page. Read only; return JSON and edit no files.',
			'This is an accuracy repair after the completed benchmark, not a new prompt-learning round.',
			`Page: ${file}`,
			'Current page:', pages[file],
			'Confirmed source defect: SourceControlMenu.vue choose(id) calls close() before emitting choose.',
			'FilesPanel.vue uses SourceControlMenu for More options. The menu closes after choosing each item.',
			'The page currently opens the menu once, then instructs the reader to make three choices.',
			'Correct that sequence. A reader may change one setting or several settings. Avoid requiring unnecessary changes.',
			'Name More options as the three vertical dots in the header, supported by the rule and component.',
			'Keep the existing title, page type, generated mark, and valid related-page links.',
			'Keep the page concise and focused. Do not add other features or troubleshooting for normal menu behavior.',
			'Keep source comments and name SourceControlMenu.vue where the menu-closing fact is documented.',
			'Read only these relevant sources and their applicable context files:',
			this.rule,
			'docs/agents_rules/glossary.md',
			'packages/apps/web_frontend/src/components/FilesPanel.vue',
			'packages/apps/web_frontend/src/components/SourceControlMenu.vue',
			'Style:', style,
			'Answer JSON only: {"content":"complete corrected Markdown", "report":"what was corrected"}.',
			this.instructions,
		].join('\n\n');
		const answer = await this._phase('writer', () => DocumentationAgent.run(
			prompt, 'codex', this.root, this._progress('writer'), false, 'gpt-6.1-sol', 'high',
		));
		this._save('writer_answer.txt', answer);
		const response = z.object({
			content: z.string().min(100),
			report: z.string().min(1),
		}).parse(JSON.parse(HeidrunDocumentationModelComparison375._removeTrailingCommas(answer)));
		if (JSON.stringify(this._snapshot()) !== JSON.stringify(pages)) {
			throw new Error('The read-only repair agent edited files. The saved snapshot remains available.');
		}
		Fs.writeFileSync(Path.join(this.root, file), response.content);
		this._save('writer_report.txt', response.report);
		this._save('pages.json', this._snapshot());
		const problems = DocumentationChecks.checkAll(this.root);
		if (problems.length > 0) {
			throw new Error(problems.join('\n'));
		}
		for (const command of ['test', 'build']) {
			const result = ChildProcess.spawnSync('pnpm', ['--filter', 'website_public', command], {
				cwd: this.root,
				encoding: 'utf8',
			});
			this._save(`website_${command}.txt`, result.stdout + result.stderr);
			if (result.status !== 0) {
				throw new Error(`Website ${command} failed after the repair.`);
			}
		}
		const judged = await this._phase('judge', () => DocumentationJudge.run({
			repositoryPath: this.root,
			agentName: 'claude',
			onlyPageFiles: [Path.basename(file)],
			isDryRun: false,
			runAgentFn: async (judgePrompt, agent, root, progress, edit, model, effort) => {
				const judgement = await DocumentationAgent.run(judgePrompt + this.instructions,
					agent, root, this._progress('judge'), edit, model, effort);
				this._save('judge_answer.txt', judgement);
				return HeidrunDocumentationModelComparison375._removeTrailingCommas(judgement);
			},
		}));
		this._save('judgement.json', judged.judgement);
		this._save('judgement.md', DocumentationJudge.renderReport(judged.judgement));
		process.stdout.write('Accuracy repair and verification finished.\n');
	}
}

HeidrunDocumentationAccuracyRepair375.run().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
	process.exitCode = 1;
});
