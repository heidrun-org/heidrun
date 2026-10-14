import { DocumentationAgent } from '/Users/jetienne/webwork/heidrun/.claude/worktrees/codex/documentation-experiment-375/packages/dev_tools/documentation_updater/src/documentation_agent.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunAddFilesScreenshots — adds supplied application captures to generated pages
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Adds the verified screenshots without regenerating unrelated content. */
class HeidrunAddFilesScreenshots {
	/**
	 * Runs the targeted writing pass.
	 * @returns A promise that resolves after the coding agent finishes.
	 */
	static async run() {
		const prompt = `Correct exactly one generated documentation fact in packages/auxiliary/website_public/docs/documentation/files_sidebar_section_controls.md. The untracked-file indicator in the table was incorrectly changed to ?. FilesPanel.vue explicitly renders entry.row.status === "?" ? "U" : entry.row.status. Read that exact template line, then change the table indicator back to **U**. The backend stores ?, but the person sees U. Keep every other word, table row, heading, comment, and image unchanged. Do not edit any other file. This is a targeted source accuracy correction, not a new rewrite. No tests, generators, subagents, staging, branch changes, commits, pushes, pull requests, or merges. Return a short confirmation.`
		const report = await DocumentationAgent.run(
			prompt,
			'codex',
			'/Users/jetienne/webwork/heidrun/.claude/worktrees/codex/documentation-experiment-375',
			(message) => {
				process.stderr.write(`${message}\n`);
			},
			true,
			'gpt-6.1-sol',
			'high',
		);
		process.stdout.write(`${report}\n`);
	}
}

await HeidrunAddFilesScreenshots.run();
