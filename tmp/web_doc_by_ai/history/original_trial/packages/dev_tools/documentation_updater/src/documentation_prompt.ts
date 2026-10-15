import { DocumentationPaths } from './documentation_paths.ts';
import type { DocumentationHintSet } from './documentation_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationPrompt — writes the two prompts that tell the coding agent how to update the documentation
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Builds the two prompts for the coding agent. The outline prompt asks for a plan of the pages, with no edit. The
 * writing prompt asks the coding agent to write the pages from that plan. Both prompts hold the same sources, page
 * types, style, and hints. The coding agent reads the documentation pages, the rule files, and the code itself,
 * because it runs in the repository.
 */
export class DocumentationPrompt {
	/** The four page types of the Diátaxis framework, as they are written in the comment `page type`. */
	static readonly pageTypes = ['tutorial', 'how-to', 'reference', 'explanation'];

	/**
	 * Builds the outline prompt: the first pass, which plans the pages and edits no file.
	 * @param hints The hints between the last documented commit and the current commit.
	 * @param onlyRuleFiles The rule files that limit the run, or an empty list for a full check.
	 * @returns The prompt, in Markdown.
	 */
	static buildOutline(hints: DocumentationHintSet, onlyRuleFiles: string[] = []): string {
		const promptText = /* markdown */ `
You plan the user documentation of the application Heidrun. You run inside the Git repository of Heidrun. In this pass you DO NOT edit any file: you only read, and you answer with an outline. A second pass writes the pages from your outline.

${DocumentationPrompt._buildContextText(onlyRuleFiles)}

${DocumentationPrompt._buildPageTypesText()}

${DocumentationPrompt._buildStyleText()}

## Your final answer: the outline

Read the current pages, the rule files, and the glossary first. Then answer with the outline of ALL the pages that must exist after this run, and nothing else, in this form:

\`\`\`
### <file name, for example copy_a_file_path.md>
- Action: add | change | keep | remove
- Page type: tutorial | how-to | reference | explanation
- Title: <the title of level one>
- Reader goal: <one sentence: what the reader wants to do or know>
- Sources: <the rule files, relative to the root of the repository>
- Sections:
  - <heading of level two>: <one sentence on what it says>
- Troubleshooting: <the symptoms that the sources show, or none>
- Related pages: <the file names of 2 to 4 other pages>
- Leave out: <the details of the rules that the reader does not need>
\`\`\`

Then add one last part "### Sidebar" with the groups and the pages of the sidebar, in order.

Check your outline before you answer: each page has one type and one reader goal, a how-to page holds one task or a few close tasks, and no page restates a rule file.

## Hints

${DocumentationPrompt._buildHintsText(hints)}
`;
		return promptText.trim();
	}

	/**
	 * Builds the writing prompt: the second pass, which writes the pages from the outline of the first pass.
	 * @param hints The hints between the last documented commit and the current commit.
	 * @param onlyRuleFiles The rule files that limit the run, or an empty list for a full check.
	 * @param outline The outline that the first pass returned.
	 * @returns The prompt, in Markdown.
	 */
	static buildWriting(hints: DocumentationHintSet, onlyRuleFiles: string[], outline: string): string {
		const { documentationFolder, sidebarConfigFile, generatedMark, rulesFolder } = DocumentationPaths;
		const promptText = /* markdown */ `
You write the user documentation of the application Heidrun. You run inside the Git repository of Heidrun, and you may edit files. No person writes or edits a documentation page by hand: you own the generated pages.

## Task

A first pass planned the pages. Its outline is below. Write the pages of the outline: add, change, or remove each page as its action says, and update the sidebar. Follow the outline. Leave it only when a source shows that the outline is wrong, and say so in your report.

${DocumentationPrompt._buildContextText(onlyRuleFiles)}

${DocumentationPrompt._buildPageTypesText()}

${DocumentationPrompt._buildStyleText()}

## Rules for the files

- The first line after the title of every page that you write is exactly this comment: \`${generatedMark}\`. The next line is the page type, for example \`<!-- page type: how-to -->\`. Without these two comments, the test of the repository fails.
- Under every heading of level two, except "Related pages", write a comment that names the source of the section, for example \`<!-- source: ${rulesFolder}/sidebars/files.md -->\`. The path is relative to the root of the repository, and the file must exist. When a section has several sources, write one comment for each. When a fact comes only from the code and from no rule file, also name the code file in a source comment, so a reader of the page can check the fact.
- Do not edit the page \`${DocumentationPaths.shortcutsPageName}\`. The command \`pnpm docs:shortcuts\` generates it.
- Do not edit the file \`.last_documented_commit\`. The command writes it after you finish.
- Write each page with one title of level one. Link only to pages that exist after this run.
- In the sidebar in \`${sidebarConfigFile}\`, make one group for each page type that has pages, in this order: "Get started" (tutorial), "How-to guides", "Reference", "Explanation". The page \`${DocumentationPaths.shortcutsPageName}\` goes in "Reference". Remove the link of each removed page.
- Do not write raw angle brackets outside code, because VitePress reads \`<name>\` as a Vue tag and the build fails. Do not use tab characters.
- Write each paragraph as one long line. Do not wrap lines.
- Edit only files in \`${documentationFolder}\` and the file \`${sidebarConfigFile}\`.

## The outline to follow

${outline.trim()}

## Your final answer

Your final answer is a report of the generated file changes, in Markdown. It has three lists with the titles "Added", "Changed", and "Removed". Each item names a page or a section and gives the reason in one sentence. Write "none" under a title that has no item. Write nothing else.

## Hints

${DocumentationPrompt._buildHintsText(hints)}
`;
		return promptText.trim();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Writes the part of both prompts that says what to check, where to read, and what to trust.
	 * @param onlyRuleFiles The rule files that limit the run, or an empty list for a full check.
	 * @returns The text, in Markdown.
	 */
	private static _buildContextText(onlyRuleFiles: string[]): string {
		const { documentationFolder, rulesFolder, glossaryFile, sidebarConfigFile } = DocumentationPaths;
		const contextText = /* markdown */ `
## Scope

Git history is read only in this process. Never stage files, create or switch branches, write commits, push, merge, or create a pull request or merge request. The developer handles those actions outside this process. Leave generated files uncommitted. Preserve existing local changes outside the files allowed by this task.

Do a full check of the user documentation. Compare ALL the documentation pages with ALL the current rules and with the code. For each feature of the application, add a page or a section for a new feature, change the section of a changed feature, remove the section of a removed feature, and do nothing for an internal change (refactor, test, build, developer tool). Remove a whole page when all its sections are removed.

The hints at the end only say which parts to look at first. Do not trust the hints as the truth.

${DocumentationPrompt._buildLimitText(onlyRuleFiles)}## Where to read

- The documentation pages are in the folder \`${documentationFolder}\`.
- The rules of the user interface are in the folder \`${rulesFolder}\`, in many small files.
- The glossary is the file \`${glossaryFile}\`. Use the words of the glossary, and no other word, for each part of the application.
- The code of the application is in the folder \`packages/apps\`. Read it when a rule is not enough.
- The sidebar of the website is in the file \`${sidebarConfigFile}\`.

## Source of truth, in this order

1. The rule files in \`${rulesFolder}\` and the glossary. The rules say what the application does now, so a removed feature is also removed from the rules.
2. The code of the application.
3. The pull requests and the issues in the hints. They say what changed and why. They are hints, not the source of truth. You may run \`gh issue view <number>\` to read an issue.

Write only what the sources show. Never invent a feature. Never write about a feature that no rule or code shows.
`;
		return contextText.trim();
	}

	/**
	 * Writes the part of both prompts that explains the four page types of the Diátaxis framework.
	 * @returns The text, in Markdown.
	 */
	private static _buildPageTypesText(): string {
		const pageTypesText = /* markdown */ `
## Page types

Each page has exactly ONE type, from the Diátaxis framework (https://diataxis.fr). Never mix two types in one page: a page that mixes steps and descriptions is the main reason why a page is hard to read.

- **tutorial**: a lesson for a new user. A short path of steps that leads to a first success with Heidrun. Only the page \`index.md\` is a tutorial.
- **how-to**: the steps that solve one task of a person who already uses Heidrun, for example "Copy the path of a file". The title starts with a verb. Most pages are how-to pages.
- **reference**: a dry description to look up, mostly tables: the buttons of a header, the items of a menu, the options of a window. No steps and no story.
- **explanation**: why a feature works the way it does, for example the state "Needs you". Write one only when a person cannot use a feature well without the idea.

### Troubleshooting

A how-to page ends with a section \`## Troubleshooting\` when the sources show a failure that the reader can meet: an error message, a button that is disabled, something that does not appear, or a change that is lost. Never invent a failure, and leave the section out when the sources show none. Write each problem in this shape:

- A heading of level three that says the symptom as the reader sees it, for example "The name box stays open".
- **Cause**: one sentence.
- **Solution**: numbered steps.
- **Check**: one sentence that says how the reader sees that it works now.

### Related pages

Every page ends with a section \`## Related pages\`: a bullet list of 2 to 4 links to the other pages that a reader of this page may need next, each with a few words that say why, for example \`- [Copy a file path](/documentation/copy_a_file_path): to paste the path in a terminal\`. A link starts with \`/documentation/\` and has no \`.md\` at the end. Link only to pages that exist after this run.

Organize the pages by what the reader wants to do, not by the rule files. A page can use several rule files, and a rule file can feed several pages: for example, the rule file of a sidebar section can give two how-to pages and one reference page.
`;
		return pageTypesText.trim();
	}

	/**
	 * Writes the part of both prompts that says how a page must read.
	 * @returns The text, in Markdown.
	 */
	private static _buildStyleText(): string {
		const styleText = /* markdown */ `
## Style: the pages must be easy to read

- Write for a person using Heidrun. Explain what the person can do and how, without describing how the program works internally.
- Start each page with one sentence that says what the reader can do or find there.
- Keep each page focused on its purpose. Avoid repeating information from another page; link to that page where it helps the reader continue.
- Write the steps of a task as a numbered list, with one action in each step. Include enough information to find the control and begin, then say what result to expect or how to check that the task worked.
- Name controls as they appear on screen. When a name alone is not enough to find a control, describe where it is or what it looks like. Put control names in bold.
- Explain an unfamiliar term in plain words the first time it appears. Use the same name for the same part of Heidrun throughout the page.
- Use a table when readers need to compare or look up several controls, choices, or meanings. Give each entry a clear name and a useful explanation.
- A paragraph has at most three sentences.
- Keep pages concise. Include details when they help a reader complete a task, choose an option, understand a result, or recover from a known problem. Do not add defaults, exact dimensions, internal implementation details, or remedies that are not supported by the sources.
- Make links useful for the next step: say what the linked page helps the reader do or find.
- Describe a known problem with its symptom and supported cause and solution. Include a check when the reader can verify that the solution worked.
`;
		return styleText.trim();
	}

	/**
	 * Writes the part of the prompt that limits the run to some rule files.
	 * @param onlyRuleFiles The rule files that limit the run, or an empty list for a full check.
	 * @returns The text, with a blank line at the end, or an empty text for a full check.
	 */
	private static _buildLimitText(onlyRuleFiles: string[]): string {
		if (onlyRuleFiles.length === 0) {
			return '';
		}
		const fileLines = onlyRuleFiles.map((ruleFile) => {
			return `- \`${ruleFile}\``;
		});
		return [
			'## Limit of this run',
			'',
			'This run is NOT a full check. Plan and write only the pages for the features that these rule files describe, and the pages that name them as source. Do not add, change, or remove any other page.',
			'',
			...fileLines,
			'',
			'',
		].join('\n');
	}

	/**
	 * Writes the part of the prompt that holds the hints.
	 * @param hints The hints between the last documented commit and the current commit.
	 * @returns The text of the hints, in Markdown.
	 */
	private static _buildHintsText(hints: DocumentationHintSet): string {
		if (hints.lastDocumentedCommit === null) {
			return 'This is the first run. There is no last documented commit, so there are no hints. Do the full check only.';
		}
		const pullRequestLines = hints.mergedPullRequests.map((pullRequest) => {
			return `- #${pullRequest.number}: ${pullRequest.title}`;
		});
		const issueLines = hints.fixedIssueNumbers.map((issueNumber) => {
			return `- #${issueNumber}`;
		});
		const fileLines = hints.changedFiles.map((changedFile) => {
			return `- \`${changedFile}\``;
		});
		const truncatedLine = hints.isRulesDiffTruncated ? '\nThe diff is cut here because it is too long. Run `git diff` to read the rest.' : '';
		const sections = [
			`The last documented commit is \`${hints.lastDocumentedCommit}\`. The current commit is \`${hints.currentCommit}\`.`,
			'### Merged pull requests since the last documented commit',
			pullRequestLines.length === 0 ? 'none' : pullRequestLines.join('\n'),
			'### Issues that these commits fix',
			issueLines.length === 0 ? 'none' : issueLines.join('\n'),
			'### Files changed in the application, the rules, and the glossary',
			fileLines.length === 0 ? 'none' : fileLines.join('\n'),
			'### Diff of the rules and of the glossary',
			hints.rulesDiff === '' ? 'none' : `\`\`\`diff\n${hints.rulesDiff}\n\`\`\`${truncatedLine}`,
		];
		return sections.join('\n\n');
	}
}
