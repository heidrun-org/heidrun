import Fs from 'node:fs';
import Path from 'node:path';
import { DocumentationUpdate } from './packages/dev_tools/documentation_updater/src/documentation_update.ts';
import { DocumentationAgent } from './packages/dev_tools/documentation_updater/src/documentation_agent.ts';
import { DocumentationJudge } from './packages/dev_tools/documentation_updater/src/documentation_judge.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	RunKnownFixes — preserves the real writer and calibrated judge evidence
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const __dirname = import.meta.dirname;

/** Runs the existing generator or judge and preserves all model inputs and answers. */
class RunKnownFixes {
	/** Folder holding the evidence for this run. */
	static resultPath = Path.resolve(__dirname, '../results/known_files_fixes_20261014');

	/**
	 * Executes the selected stage.
	 * @param stage The writer or judge stage.
	 * @returns Resolves after the stage and evidence recording finish.
	 */
	static async main(stage) {
		const settings = {
			repositoryPath: __dirname,
			agentName: stage === 'writer' ? 'codex' : 'claude',
			model: stage === 'writer' ? 'gpt-6.1-sol' : 'claude-sonnet-5-5',
			effort: 'high',
			isDryRun: false,
			onStep: (message) => console.error(message),
			runAgentFn: RunKnownFixes._runAgent,
		};
		Fs.writeFileSync(Path.join(RunKnownFixes.resultPath, `${stage}_settings.json`),
			JSON.stringify(settings, null, 2));
		if (stage === 'writer') {
			const result = await DocumentationUpdate.run({
				...settings,
				onlyRuleFiles: ['docs/agents_rules/user_interface/sidebars/files.md'],
			});
			Fs.writeFileSync(Path.join(RunKnownFixes.resultPath, 'writer_report.md'), result.report);
			return;
		}
		const result = await DocumentationJudge.run({
			...settings,
			onlyPageFiles: [
				'browse_project_files.md', 'copy_a_file_path.md',
				'create_a_file_or_folder.md', 'files_sidebar_section_controls.md',
			],
		});
		Fs.writeFileSync(Path.join(RunKnownFixes.resultPath, 'judgement.json'),
			JSON.stringify(result.judgement, null, 2));
		Fs.writeFileSync(Path.join(RunKnownFixes.resultPath, 'judge_report.md'),
			DocumentationJudge.renderReport(result.judgement));
	}

	/**
	 * Records and runs a genuine model pass through the existing agent adapter.
	 * @param prompt The generated prompt.
	 * @param agentName The model command.
	 * @param repositoryPath The parked workspace.
	 * @param onProgress The generator progress callback.
	 * @param isEditAllowed Whether this is the editing pass.
	 * @param model The requested model.
	 * @param effort The requested effort.
	 * @returns The real model answer.
	 */
	static async _runAgent(prompt, agentName, repositoryPath, onProgress, isEditAllowed, model, effort) {
		const stage = agentName === 'claude' ? 'judge' : (isEditAllowed === true ? 'writing' : 'outline');
		let promptStr = prompt;
		if (agentName === 'codex') {
			const findings = Fs.readFileSync(Path.join(RunKnownFixes.resultPath, 'known_findings.md'), 'utf8');
			promptStr += `\n\n## Resumed task: correct the verified findings\n\n${findings}\n`
				+ `Use only the captured source tree at ${repositoryPath}. Git publication is forbidden.\n`
				+ 'Do not edit source, rules, prompts, tests or unselected pages. Only fix the two known issues.\n'
				+ 'Do not use subagents. Preserve existing images and page names.\n';
		}
		Fs.writeFileSync(Path.join(RunKnownFixes.resultPath, `${stage}_prompt.md`), promptStr);
		const answer = await DocumentationAgent.run(promptStr, agentName, repositoryPath, (message) => {
			Fs.appendFileSync(Path.join(RunKnownFixes.resultPath, `${stage}_progress.txt`), `${message}\n`);
		}, isEditAllowed, model, effort);
		Fs.writeFileSync(Path.join(RunKnownFixes.resultPath, `${stage}_answer.txt`), answer);
		return answer;
	}
}

RunKnownFixes.main(process.argv[2]).catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
