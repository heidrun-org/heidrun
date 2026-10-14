import Fs from 'node:fs';
import Path from 'node:path';
import ChildProcess from 'node:child_process';
import { DocumentationJudge } from '/Users/jetienne/webwork/heidrun/.claude/worktrees/codex/documentation-experiment-375/packages/dev_tools/documentation_updater/src/documentation_judge.ts';
import { DocumentationAgent } from '/Users/jetienne/webwork/heidrun/.claude/worktrees/codex/documentation-experiment-375/packages/dev_tools/documentation_updater/src/documentation_agent.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunJudgeFilesWithImages — judges the Files pages and supplied screenshots
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Runs the existing judge with an explicit request to inspect the screenshot files. */
class HeidrunJudgeFilesWithImages {
	/**
	 * Saves the judge result outside the repository and confirms that the repository is unchanged.
	 * @returns A promise that resolves after the report is saved.
	 */
	static async run() {
		const repositoryPath = '/Users/jetienne/webwork/heidrun/.claude/worktrees/codex/documentation-experiment-375';
		const outputPath = '/Users/jetienne/.codex/visualizations/2026/10/13/01a136cd-3ef5-75e3-9a2d-0bbf5efbaea0/files_images_judgement_final';
		Fs.mkdirSync(outputPath, {
			recursive: true,
		});
		const before = HeidrunJudgeFilesWithImages._snapshot(repositoryPath);
		const result = await DocumentationJudge.run({
			repositoryPath,
			agentName: DocumentationJudge.defaultAgentName,
			onlyPageFiles: [
				'browse_project_files.md',
				'create_a_file_or_folder.md',
				'copy_a_file_path.md',
				'files_sidebar_section_controls.md',
			],
			isDryRun: false,
			onStep: (message) => {
				process.stderr.write(`${message}\n`);
			},
			onAgentProgress: (message) => {
				process.stderr.write(`${message}\n`);
			},
			runAgentFn: async (prompt, agent, root, onProgress, isEditAllowed, model, effort) => {
				const imageInstructions = `
## Screenshots in this judgement

Inspect the actual local PNG files referenced by the four pages. The URL prefix /documentation_images/ maps to packages/auxiliary/website_public/docs/public/documentation_images/. Read the metadata in its files/screenshots.json. Read the PNGs with your image-reading tool; do not infer their appearance only from alternative text or file names.

Judge screenshot readability, whether each screenshot shows the described control or task state, and whether placement helps a reader, within the existing six criteria. Do not add new score fields. If you cannot inspect the pixels, say that explicitly in the problems rather than claiming to have visually verified the screenshots. Do not invent source support from screenshots alone.

This is a read-only evaluation. Do not edit files, stage, change branches, commit, push, create a pull request, or merge. Do not run generators or use subagents. Return only the JSON required above.`;
				const answer = await DocumentationAgent.run(
					prompt + imageInstructions,
					agent,
					root,
					onProgress,
					isEditAllowed,
					model,
					effort,
				);
				Fs.writeFileSync(Path.join(outputPath, 'raw_answer.txt'), answer);
				return answer;
			},
		});
		if (result.judgement === null) {
			throw new Error('The judge returned no judgement.');
		}
		Fs.writeFileSync(Path.join(outputPath, 'judgement.json'), JSON.stringify(result.judgement, null, 2));
		const report = DocumentationJudge.renderReport(result.judgement);
		Fs.writeFileSync(Path.join(outputPath, 'report.md'), `${report}\n`);
		if (HeidrunJudgeFilesWithImages._snapshot(repositoryPath) !== before) {
			throw new Error('The repository changed during the judgement; inspect the changes.');
		}
		process.stdout.write(`${report}\nRepository files, branch, commit, and staged changes are unchanged.\n`);
	}

	/**
	 * Captures Git state and the contents of changed or untracked files.
	 * @param repositoryPath The worktree to inspect.
	 * @returns A serialized snapshot for comparison.
	 */
	static _snapshot(repositoryPath) {
		const git = (args) => ChildProcess.execFileSync('git', args, {
			cwd: repositoryPath,
			encoding: 'utf8',
		});
		const names = git(['ls-files', '--modified', '--others', '--exclude-standard', '-z']).split('\0');
		return JSON.stringify({
			commit: git(['rev-parse', 'HEAD']),
			branch: git(['branch', '--show-current']),
			status: git(['status', '--porcelain']),
			index: git(['diff', '--cached']),
			files: names.filter((name) => name !== '').map((name) => {
				const filePath = Path.join(repositoryPath, name);
				return [name, Fs.existsSync(filePath) === true ? Fs.readFileSync(filePath).toString('base64') : null];
			}),
		});
	}
}

await HeidrunJudgeFilesWithImages.run();
