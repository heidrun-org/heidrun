import Fs from 'node:fs';
import { DocumentationAgent } from '/Users/jetienne/webwork/heidrun/.claude/worktrees/codex/documentation-experiment-375/packages/dev_tools/documentation_updater/src/documentation_agent.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunFixFilesJudgeFindings — corrects the four generated Files sidebar pages
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Corrects verified findings while keeping the documentation experiment narrow. */
class HeidrunFixFilesJudgeFindings {
	/**
	 * Runs a targeted documentation correction with the approved top writer model.
	 * @returns A promise that resolves after the writing pass completes.
	 */
	static async run() {
		const report = Fs.readFileSync('/Users/jetienne/.codex/visualizations/2026/10/13/01a136cd-3ef5-75e3-9a2d-0bbf5efbaea0/files_images_judgement_after_fixes/report.md', 'utf8');
		const prompt = `Make a second, narrow correction to the same four Files sidebar pages. Read the actual sources before changing facts and preserve the learned style, generated marks, page types, source comments, screenshots, filenames, and sidebar. The feedback below is not authoritative: reject advice that conflicts with source evidence or the scope.

Correct these concrete remaining issues:
1. The links in copy/create pages point only to the workspace-selection section, while their link text promises how to show Files and find a file. Keep those links for selecting a workspace, and add one short explicit step that clicks Files in the left sidebar icon bar and unfolds the destination/containing folders. Do not force readers to guess or open a file when they only need its context menu.
2. Use the established words status bar and folder tree consistently. Replace developer phrases such as first child and tree entry with ordinary descriptions. In creation, describe the always-French duplicate-name message accurately and simplify the empty-folder paragraph without suggesting deletion from disk.
3. Browse: make closing the Git window optional (when finished viewing) rather than immediately closing the task result. Remove commentary about .pnpm-store and its dot and about the Git window not being in the picture. Use the sidebar screenshot near the navigation steps as an example of locating the file, not evidence of an open file window. Give its state a short useful caption or alternative text. Explain the opened Git window and Close/Escape from source. Prefer a concise how-to.
4. Browse: if an existing suitable workspace is not listed, briefly identify New workspace… in the workspace information card and choosing the repository folder. This stays a Files-task prerequisite, not a new workspace tutorial. Keep Introduction and all unrelated pages unchanged.
5. Treat the long-list warning honestly. Source shows a cap and no in-app way to load the rest. Do not fabricate a solution merely to satisfy a symptom/cause/solution/check template. A concise limitation alongside a useful browsing check is preferable to a false recovery procedure. Avoid mentioning a second undefined window's search.
6. Reference: add a short lookup table of row/name-box actions using sources; no numbered procedures. Split the mixed Visibility and selection table into small Selection and Ignored files sections. Explain how the Files window is opened using the supported shortcut from the existing shortcuts page; keep the instructions concise. Remove repeated empty-folder and long-list detail, linking to the task pages instead. State useful supported defaults (Medium, Comfortable, Show) in the appearance lookup table. Preserve **U**, which FilesPanel.vue displays for untracked files, not the backend question mark. Simplify selected-row indicator wording.
7. Copy: remove the redundant sentence describing every visible part of the screenshot. Preserve its placement while the context menu is open, before choosing a path. Use an appropriate related link to File context menu rather than changed-file indicators, and say paste in the other application. Creation: remove the redundant example caption while keeping the screenshot before Enter.

All four supplied screenshots were visually retaken and the lower edges of the browse/copy crops were tightened so they do not end through a text row. Do not change them. Do not chase site feedback that requests unrelated pages or a replacement Introduction. The user explicitly limited the correction to the Files sidebar pages.

Edit only browse_project_files.md, create_a_file_or_folder.md, copy_a_file_path.md, and files_sidebar_section_controls.md under packages/auxiliary/website_public/docs/documentation. Do not change source, rules, prompts, metadata, sidebar, other pages, or Git state. No commits, staging, branch changes, pushes, pull requests, merges, subagents, recursive generators, or tests. The parent handles build and judgement.

Feedback:
${report}

Return a short correction report with any unresolved source or scope limits.`
		const answer = await DocumentationAgent.run(
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
		process.stdout.write(`${answer}\n`);
	}
}

await HeidrunFixFilesJudgeFindings.run();
