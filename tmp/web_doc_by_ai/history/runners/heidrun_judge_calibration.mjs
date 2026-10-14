import Fs from 'node:fs';
import Path from 'node:path';
import ChildProcess from 'node:child_process';
import Crypto from 'node:crypto';
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
		const outputPath = `/Users/jetienne/.codex/visualizations/2026/10/13/01a136cd-3ef5-75e3-9a2d-0bbf5efbaea0/judge_consistency/${process.argv[2]}`;
		Fs.mkdirSync(outputPath, {
			recursive: true,
		});
		const before = HeidrunJudgeFilesWithImages._snapshot(repositoryPath);
		const inputNames = [
			...DocumentationJudge.readPages(repositoryPath, [
				'browse_project_files.md', 'create_a_file_or_folder.md', 'copy_a_file_path.md', 'files_sidebar_section_controls.md',
			]).map((page) => `packages/auxiliary/website_public/docs/documentation/${page.file}`),
			'packages/auxiliary/website_public/docs/.vitepress/config.ts',
			...Fs.readdirSync(Path.join(repositoryPath, 'packages/auxiliary/website_public/docs/public/documentation_images/files'))
				.map((name) => `packages/auxiliary/website_public/docs/public/documentation_images/files/${name}`),
		];
		const hashes = Object.fromEntries(inputNames.map((name) => [name,
			Crypto.createHash('sha256').update(Fs.readFileSync(Path.join(repositoryPath, name))).digest('hex'),
		]));
		Fs.writeFileSync(Path.join(outputPath, 'input_hashes.json'), JSON.stringify(hashes, null, 2));

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
				const start = prompt.indexOf('### Page `copy_a_file_path.md`');
				const end = prompt.indexOf('### Page `create_a_file_or_folder.md`', start);
				prompt = prompt.slice(0, start) + prompt.slice(start, end).replaceAll('**Copy relative path**', '**Upload file to GitHub**') + prompt.slice(end);
				Fs.writeFileSync(Path.join(outputPath, 'calibration.txt'), 'Negative control: only the in-memory copy-page text replaces Copy relative path with unsupported Upload file to GitHub. Repository pages and images are unchanged. Expected accuracy and taskSuccess <= 2 for this page.\n');
				Fs.writeFileSync(Path.join(outputPath, 'prompt.md'), prompt);
				const answer = await DocumentationAgent.run(
					prompt,
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
		Fs.writeFileSync(Path.join(outputPath, 'unchanged.txt'), 'Repository files, branch, commit, and staged changes are unchanged.\n');
		process.stdout.write(`Overall: ${result.judgement.overallScore}. Saved ${outputPath}. Repository unchanged.\n`);
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
