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
		const report = Fs.readFileSync('/Users/jetienne/.codex/visualizations/2026/10/13/01a136cd-3ef5-75e3-9a2d-0bbf5efbaea0/files_images_judgement/report.md', 'utf8');
		const prompt = `Correct the verified problems of the judge report below in exactly these four generated Heidrun documentation pages:
- packages/auxiliary/website_public/docs/documentation/browse_project_files.md
- packages/auxiliary/website_public/docs/documentation/create_a_file_or_folder.md
- packages/auxiliary/website_public/docs/documentation/copy_a_file_path.md
- packages/auxiliary/website_public/docs/documentation/files_sidebar_section_controls.md

The four screenshot files have already been retaken from the real current application. Read packages/auxiliary/website_public/docs/public/documentation_images/files/screenshots.json and inspect the PNGs. They now have no pointer over the controls. copy_path.png includes the Files header, docs folder, selected docs/README.md, and both menu items. new_file.png shows example.md before Enter, and files_sidebar.png shows docs/README.md selected after the Git window was closed. Place each screenshot next to the state it actually shows, before any later action. Describe screenshot examples clearly; never imply that a closed file window is visible in the sidebar image. Do not modify screenshots or metadata.

Verify the judge's claims against the current rule files and source code; the judge is feedback, not the source of truth. Preserve the learned style from packages/dev_tools/documentation_updater/src/documentation_prompt.ts. Read the applicable context and glossary. Add source comments for any facts taken from additional source files.

Required corrections:
- Explain selecting an existing workspace through the workspace name at the bottom-left and the list in its information card, using docs/agents_rules/user_interface/workspaces_tabs_and_panes/workspace.md and WorkspaceStatusSummary.vue. Keep this prerequisite compact on the browse page; other Files pages can link to it instead of repeating it.
- Explain the large Git window in ordinary words: it opens over the application to show the file. State how to close it with Escape or Close. Verify this in FilesModal.vue and its translations. Do not rename the established window.
- Remove normal loading or unchanged-file behaviour from troubleshooting. Explain unchanged files briefly as the expected result. Give Refresh a real reason and a concrete result check. Simplify the sentence about removed empty folders.
- Address the long-list warning using the verified cap of 50,000 entries in packages/apps/desktop_tauri/src/files.rs. Do not invent a control, a working search beyond that cap, or a remedy not supported by the sources. Describe the limitation honestly where it helps browsing.
- Match the duplicate-name error to the actual backend message, which can be French even with the English interface. Cite files.rs. The slash-name correction only needs removing the slash and pressing Enter while the box remains open; do not force cancellation and reselection.
- Explain the empty-folder limitation where readers create folders: Git does not list empty folders and Heidrun remembers newly created empty folders only until restart. Distinguish losing the tree entry from deleting the folder on disk.
- Help readers choose an absolute versus relative path with concrete, clearly labelled examples, and put the Copied notification into one result sentence. Use plain words for the small notification and explain any required glossary term. Link to the browse prerequisite rather than repeating all opening steps.
- Tighten the reference page: retain useful control and status tables, remove repeated copy instructions and trivial descriptions, and explain where the Ignored files option is located using verified FilesModal.vue, translation, and store sources. Keep any click steps on a task page, not a reference page.
- Use consistent control names and useful related-page links with specific reasons. Link to existing Keyboard shortcuts when useful; never modify that page.

Keep the page types and generated marks. All relevant level-two sections must have source comments. Keep the current page filenames and sidebar unchanged. The Introduction placeholder and the lack of a full-site landing page are outside this scope; do not fix them or add unrelated pages. Do not add speculative failures or features, exact dimensions, or internal settings.

Edit only the four listed Markdown pages. No source, rule, prompt, sidebar, metadata, Introduction, or Keyboard shortcuts edits. Git history is read only: no staging, branch changes, commits, pushes, pull requests, or merges. No recursive generators or subagents. Do not run tests; the parent process handles the build and the judge.

Judge report:
${report}

Return a concise report describing corrected findings and any rejected or out-of-scope feedback.`;
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
