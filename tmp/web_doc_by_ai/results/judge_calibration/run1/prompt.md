You judge the user documentation of the application Heidrun, as a strict and experienced technical writer. You run inside the Git repository of Heidrun. DO NOT edit any file: you only read, and you answer with JSON.

The pages are for a person who uses Heidrun, not for a developer. Each page must have one page type of the Diátaxis framework (https://diataxis.fr), named in its comment `<!-- page type: ... -->`:

- **tutorial**: a lesson for a new user, with a short path of steps to a first success.
- **how-to**: the steps that solve one task of a person who already uses Heidrun.
- **reference**: a dry description to look up, mostly tables.
- **explanation**: why a feature works the way it does.

## Evaluation scope

Selected pages: sample_19.md, sample_42.md, sample_07.md, sample_63.md, sample_28.md, sample_55.md, sample_34.md, sample_81.md, sample_12.md, sample_46.md, sample_73.md, sample_90.md.

This is a LIMITED feature evaluation. Score only the selected pages and their findability in the sidebar. The Introduction, other unselected pages, absence of a site-wide tutorial, and unrelated features are outside scope and cannot reduce any score. Put any such observations in limitations, not findings or problems. A limited set does not need every Diátaxis page type. Existing linked prerequisites can be read for context, but do not demand editing unselected pages.

Read the sources named in each page and the glossary. Inspect referenced screenshots from packages/auxiliary/website_public/docs/public when evaluating their pixels. Follow the fixed contract below; mechanical measures are context, not automatic penalties.

## Fixed evaluation contract: version 2

Evaluate reader outcomes, not whether you could rewrite the page differently. Do not read earlier judge reports or use earlier scores as targets. Optional editorial preferences are suggestions and do not reduce scores. Do not propose a change and also penalise the acceptable alternative.

### Score anchors and evidence

Each finding names one criterion, a page heading/step/image or selected sidebar item, the observed evidence, the reader impact, and a correction. For a source-dependent claim, give the relative source file and the relevant source evidence; verify the rendered interface when code transforms backend data. Distinguish a false claim from a missing source comment. Do not infer a false claim merely because a term is absent from the glossary.

The score for each criterion is determined by its most severe verified finding:

| Severity | Score | Meaning |
| --- | --- | --- |
| No deduction, or suggestion only | 5 | The criterion is met. Optional alternative wording, layout, or images do not prevent 5. |
| minor | 4 | Local friction or a citation gap; the reader can still complete the task or find the information. |
| material | 3 | Demonstrable confusion or a substantial omission; the reader must make a consequential guess or do unnecessary work. |
| blocker | 2 | A demonstrated wrong instruction, unsupported feature, or missing prerequisite prevents the intended task or makes core information unreliable. |
| unusable | 1 | The page cannot support its stated task or lookup purpose. |

Do not stack minor preferences to create a material deduction. A finding can affect several criteria only with separate evidence of the impact on each criterion. State uncertainty as a suggestion or limitation, not as a verified deduction. Verify claims against the project's rules and glossary, then the actual code; disclose a rule/code conflict rather than inventing a feature. A citation gap is normally minor; a materially false operational claim is different.

### Six criteria

- taskSuccess: the stated task or lookup goal is achievable without consequential guessing, including clearly linked prerequisites. An application limitation is not a documentation failure when accurately described; do not demand an impossible solution.
- usefulness: content helps this page's task or lookup goal. Penalise duplication only when it creates demonstrable distraction or inconsistent instructions, not merely because two pages mention the same control.
- order: prerequisites and actions are findable in a usable sequence. A concise prerequisite before the main task, or a direct link to that prerequisite, is valid.
- singleType: how-to pages may have concise prerequisites, explanations of results, option tables, and supported troubleshooting. Reference pages may contain action/result lookup tables and concise location descriptions; these are not numbered task procedures.
- userLanguage: use established names for project parts, explaining unfamiliar names in plain words. Ordinary words such as name box, folder tree, and small notification do not need separate glossary entries. Judge clarity rather than exact wording of every sentence.
- accuracy: factual claims match named rule or code sources and actual screenshot states. Do not invent an inaccuracy from an alternative valid wording or from a product limitation.

### Stable decisions for recurring cases

- A reference table saying what a click or key does is valid lookup content. Do not require that table in one evaluation and reject it as how-to steps in another. Do not require every possible row action unless omission affects the page's stated lookup purpose.
- A how-to page can start with a short prerequisite or link. The link text must accurately describe the linked section; a link to workspace selection alone does not explain opening Files. Do not require a separate prerequisite page or a tutorial in a limited feature set.
- Defaults are useful in an option lookup table when supported by sources. Do not require defaults in task instructions merely because the rule file lists them.
- A screenshot may illustrate a control, an intermediate state, or a result. The caption/alternative text must describe the actual state. Require a readable relevant image near the text it helps; do not mandate a screenshot for every step, result, status letter, or notification. The same image can help adjacent header and option sections; optional repositioning is not a deduction without demonstrated reader confusion.
- Inspect every referenced local image before making a visual finding. Root image URLs map to the website's docs/public folder. If pixels cannot be inspected, report that limitation and do not claim that an image is blurry, obscured, or wrong.
- Known recoverable failures need understandable symptoms, supported recovery, and a way to check the result. No fixed heading shape is required. For an unrecoverable application limit, an honest cause/limit and a useful check are sufficient; never request an invented recovery control. Normal disabled controls for an unchanged file are expected behaviour, not mandatory troubleshooting.
- A reference page can name a related control's location when that control affects this feature. A one-sentence location or shortcut is not automatically off-topic or a how-to procedure.
- Related links must have a plausible next use. Two to four useful links are acceptable; do not reject the count or demand unrelated pages. Do not penalise the same fact separately as missing context and unnecessary repetition without explaining the actual conflict.

### Self-check before answering

Check every deduction against these anchors and stable decisions. Remove findings that merely express preferences, demand work outside scope, contradict the source, or impose mutually exclusive requirements. Check every numeric score against the severities of its evidence. Do not raise scores to show improvement: pages may genuinely have material defects under this contract.

## Your final answer

Answer with ONE JSON object and no text outside it. Use rubricVersion "2". Return exactly one entry for each selected page. Every score below 5 must have evidence with matching severity for that criterion; the parser rejects scores that disagree with evidence. Findings with severity suggestion do not reduce scores. At most 18 findings and 3 problem summaries per page; at most 8 findings and 3 summaries for the set. Limitations and outside-scope observations do not affect scores.

A finding has these fields: criterion, severity, location, evidence, impact, source (relative file path or null), sourceEvidence (source excerpt/observed behaviour or null), recommendation. Page criteria are taskSuccess, usefulness, order, singleType, userLanguage, accuracy. Set criteria are navigation and consistency. Use a source and sourceEvidence for source-dependent claims; uncertainty is not a verified finding. Problem summaries must summarise the verified findings, not introduce new requirements.

Shape (a page meeting all requirements may have scores of 5 and no findings):

```json
{
  "rubricVersion": "2",
  "pages": [
    {
      "file": "copy_a_file_path.md",
      "scores": { "taskSuccess": 5, "usefulness": 5, "order": 5, "singleType": 5, "userLanguage": 5, "accuracy": 5 },
      "findings": [],
      "problems": [],
      "verdict": "The task is achievable and the supporting information is accurate."
    }
  ],
  "site": { "navigation": 5, "consistency": 5, "findings": [], "problems": [] },
  "limitations": []
}
```

Git history is read only: never stage, change branches, commit, push, create a pull request, or merge. Do not run writers, edit files, or use subagents.

## The sidebar

```ts
import { defineConfig } from 'vitepress';
import identity from '../../../../../data/identity.json';

const base = '/heidrun/';

export default defineConfig({
	title: identity.title,
	description: identity.description.en,
	head: [
		['link', {
			rel: 'icon',
			type: 'image/svg+xml',
			href: `${base}favicon.svg`,
		}],
	],
	transformPageData(pageData) {
		if (pageData.relativePath === 'index.md') {
			pageData.frontmatter.hero = {
				...pageData.frontmatter.hero,
				name: identity.title,
				text: identity.motto.en,
				tagline: identity.description.en,
			};
		}
	},
	base,
	themeConfig: {
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Documentation', link: '/documentation/' },
			{ text: 'About', link: '/about' },
		],
		sidebar: [
			{
				text: 'Documentation',
				items: [
					{ text: 'Introduction', link: '/documentation/' },
					{ text: 'Keyboard shortcuts', link: '/documentation/shortcuts' },
				],
			},
			{
				text: 'Files',
				items: [
					{
						text: 'Browse and open project files',
						link: '/documentation/browse_project_files',
					},
					{
						text: 'Create a file or folder',
						link: '/documentation/create_a_file_or_folder',
					},
					{
						text: 'Copy a file path',
						link: '/documentation/copy_a_file_path',
					},
					{
						text: 'Files sidebar section controls',
						link: '/documentation/files_sidebar_section_controls',
					},
				],
			},
		],
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/heidrun-org/heidrun' },
		],
	},
});
```

## The pages

### Page `sample_19.md`

Measures: {"pageType":"how-to","lineCount":21,"wordCount":223,"longestParagraphSentences":3,"paragraphRuns":1,"numberedStepCount":5,"bulletCount":2,"tableCount":1,"headingCount":5,"hasTroubleshooting":true,"relatedPageLinkCount":2}

````markdown
# Copy a file path
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Copy a file path to paste into another application.

## Before you start

Select a workspace whose folder is the root of a Git repository. [Select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace) explains how.

## Steps
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

1. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**.
2. Click the containing folder rows to unfold the folders and find the file.
3. Right-click the file row to open the context menu.
4. Choose **Copy absolute path** or **Copy relative path** using the table below.
5. Paste with **⌘V** in the receiving application.

The copy changes no file. The menu closes and a small notification shows **Copied:** followed by the path.

For a repository at `/Users/alex/projects/example` and file `docs/README.md`:

| Choice | Copied text | Use when |
| --- | --- | --- |
| **Copy absolute path** | `/Users/alex/projects/example/docs/README.md` | The receiving application needs the full location. |
| **Copy relative path** | `docs/README.md` | The receiving application already knows the repository folder. |

## Troubleshooting

A folder row has no path-copy context menu. Unfold the folder and right-click a file row instead. Check that the menu shows **Copy absolute path** and **Copy relative path**.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): find the file.
- [File context menu](/documentation/files_sidebar_section_controls#file-context-menu): look up the two actions.
````

### Page `sample_42.md`

Measures: {"pageType":"how-to","lineCount":21,"wordCount":226,"longestParagraphSentences":3,"paragraphRuns":1,"numberedStepCount":5,"bulletCount":2,"tableCount":1,"headingCount":5,"hasTroubleshooting":true,"relatedPageLinkCount":2}

````markdown
# Copy a file path
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Copy a file path to paste into another application.

## Before you start

Select a workspace whose folder is the root of a Git repository. [Select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace) explains how.

## Steps
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

1. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**.
2. Click the containing folder rows to unfold the folders and find the file.
3. Right-click the file row to open the context menu.
4. Choose **Copy absolute path** or **Upload file to GitHub** using the table below.
5. Paste with **⌘V** in the receiving application.

The copy changes no file. The menu closes and a small notification shows **Copied:** followed by the path.

For a repository at `/Users/alex/projects/example` and file `docs/README.md`:

| Choice | Copied text | Use when |
| --- | --- | --- |
| **Copy absolute path** | `/Users/alex/projects/example/docs/README.md` | The receiving application needs the full location. |
| **Upload file to GitHub** | `docs/README.md` | The receiving application already knows the repository folder. |

## Troubleshooting

A folder row has no path-copy context menu. Unfold the folder and right-click a file row instead. Check that the menu shows **Copy absolute path** and **Upload file to GitHub**.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): find the file.
- [File context menu](/documentation/files_sidebar_section_controls#file-context-menu): look up the two actions.
````

### Page `sample_07.md`

Measures: {"pageType":"reference","lineCount":15,"wordCount":163,"longestParagraphSentences":3,"paragraphRuns":0,"numberedStepCount":0,"bulletCount":2,"tableCount":1,"headingCount":4,"hasTroubleshooting":false,"relatedPageLinkCount":2}

````markdown
# Files sidebar row actions
<!-- generated by docs:update_by_ai -->
<!-- page type: reference -->

Look up the actions available on Files sidebar rows.

## Row actions
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

| Action | Result |
| --- | --- |
| Click a folder row | Selects the folder and folds or unfolds it. |
| Click a file row | Selects the file and opens it in the large Git window. |
| Right-click a file row | Opens the context menu with Copy absolute path and Copy relative path. |
| Right-click a folder row | No path-copy context menu opens. |
| Click empty space outside all rows | Clears the selection for this workspace. |

## Empty folders

Heidrun remembers a new empty folder in the folder tree until Heidrun restarts. After restart, the empty folder is absent from the tree but remains on disk. Git does not list empty folders.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): open a file.
- [Create a file or folder](/documentation/create_a_file_or_folder): add an item.
````

### Page `sample_63.md`

Measures: {"pageType":"how-to","lineCount":20,"wordCount":192,"longestParagraphSentences":2,"paragraphRuns":1,"numberedStepCount":4,"bulletCount":2,"tableCount":1,"headingCount":5,"hasTroubleshooting":true,"relatedPageLinkCount":2}

````markdown
# Copy a file path
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Copy a file path to paste into another application.

## Before you start

Select a workspace whose folder is the root of a Git repository. [Select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace) explains how.

## Steps
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

1. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**.
2. Click the containing folder rows to unfold the folders and find the file.
3. Choose **Copy absolute path** or **Copy relative path** using the table below.
4. Paste with **⌘V** in the receiving application.

The copy changes no file. The menu closes and a small notification shows **Copied:** followed by the path.

For a repository at `/Users/alex/projects/example` and file `docs/README.md`:

| Choice | Copied text | Use when |
| --- | --- | --- |
| **Copy absolute path** | `/Users/alex/projects/example/docs/README.md` | The receiving application needs the full location. |
| **Copy relative path** | `docs/README.md` | The receiving application already knows the repository folder. |

## Troubleshooting

A folder row has no path-copy context menu. 

## Related pages

- [Browse and open project files](/documentation/browse_project_files): find the file.
- [File context menu](/documentation/files_sidebar_section_controls#file-context-menu): look up the two actions.
````

### Page `sample_28.md`

Measures: {"pageType":"how-to","lineCount":21,"wordCount":223,"longestParagraphSentences":3,"paragraphRuns":1,"numberedStepCount":5,"bulletCount":2,"tableCount":1,"headingCount":5,"hasTroubleshooting":true,"relatedPageLinkCount":2}

````markdown
# Copy a file path
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Copy a file path to paste into another application.

## Before you start

Select a workspace whose folder is the root of a Git repository. [Select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace) explains how.

## Steps
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

1. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**.
2. Click the containing folder rows to unfold the folders and find the file.
3. Right-click the file row to open the context menu.
4. Choose **Copy absolute path** or **Copy relative path** using the table below.
5. Paste with **⌘V** in the receiving application.

The copy changes no file. The menu closes and a small notification shows **Copied:** followed by the path.

For a repository at `/Users/alex/projects/example` and file `docs/README.md`:

| Choice | Copied text | Use when |
| --- | --- | --- |
| **Copy absolute path** | `docs/README.md` | The receiving application needs the full location. |
| **Copy relative path** | `/Users/alex/projects/example/docs/README.md` | The receiving application already knows the repository folder. |

## Troubleshooting

A folder row has no path-copy context menu. Unfold the folder and right-click a file row instead. Check that the menu shows **Copy absolute path** and **Copy relative path**.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): find the file.
- [File context menu](/documentation/files_sidebar_section_controls#file-context-menu): look up the two actions.
````

### Page `sample_55.md`

Measures: {"pageType":"how-to","lineCount":16,"wordCount":195,"longestParagraphSentences":3,"paragraphRuns":0,"numberedStepCount":4,"bulletCount":2,"tableCount":0,"headingCount":5,"hasTroubleshooting":true,"relatedPageLinkCount":2}

````markdown
# Create a file in a folder
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Create an empty file inside an existing folder.

## Before you start

[Select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace) whose folder is a Git repository. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**. Unfold the folders to find the destination folder.

## Steps
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

1. Click the destination folder row to select it. The click also folds or unfolds the folder.
2. Click **New file**, the first button in the Files header. A name box appears inside the selected folder.
3. Type only a new name, for example `example.md`, without `/`.

![Name box inside docs with example.md typed before Enter is pressed.](/documentation_images/files/new_file.png)

4. Press **Enter**. The new file becomes selected and opens in the large Git window.

Press **Escape** instead of Enter to cancel before creating the file.

## Troubleshooting

If a file or folder already has the name, an error notification appears and the name box stays open. Choose another name and press Enter. Check that the new file row appears.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): open the new file again.
- [Files sidebar section controls](/documentation/files_sidebar_section_controls): look up the header buttons.
````

### Page `sample_34.md`

Measures: {"pageType":"how-to","lineCount":21,"wordCount":232,"longestParagraphSentences":3,"paragraphRuns":1,"numberedStepCount":5,"bulletCount":2,"tableCount":1,"headingCount":5,"hasTroubleshooting":true,"relatedPageLinkCount":2}

````markdown
# Copy a file path
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Copy a file path to paste into another application.

## Before you start

Select a workspace whose folder is the root of a Git repository. [Select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace) explains how.

## Steps
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

1. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**.
2. Click the containing folder rows to unfold the folders and find the file.
3. Right-click the folder row to open the context menu and copy that folder path.
4. Choose **Copy absolute path** or **Copy relative path** using the table below.
5. Paste with **⌘V** in the receiving application.

The copy changes no file. The menu closes and a small notification shows **Copied:** followed by the path.

For a repository at `/Users/alex/projects/example` and file `docs/README.md`:

| Choice | Copied text | Use when |
| --- | --- | --- |
| **Copy absolute path** | `/Users/alex/projects/example/docs/README.md` | The receiving application needs the full location. |
| **Copy relative path** | `docs/README.md` | The receiving application already knows the repository folder. |

## Troubleshooting

A folder row has the same path-copy context menu as a file. Unfold the folder and right-click a file row instead. Check that the menu shows **Copy absolute path** and **Copy relative path**.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): find the file.
- [File context menu](/documentation/files_sidebar_section_controls#file-context-menu): look up the two actions.
````

### Page `sample_81.md`

Measures: {"pageType":"how-to","lineCount":16,"wordCount":195,"longestParagraphSentences":3,"paragraphRuns":0,"numberedStepCount":4,"bulletCount":2,"tableCount":0,"headingCount":5,"hasTroubleshooting":true,"relatedPageLinkCount":2}

````markdown
# Create a file in a folder
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Create an empty file inside an existing folder.

## Before you start

[Select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace) whose folder is a Git repository. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**. Unfold the folders to find the destination folder.

## Steps
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

1. Click the destination folder row to select it. The click also folds or unfolds the folder.
2. Click **New file**, the first button in the Files header. A name box appears inside the selected folder.
3. Type only a new name, for example `example.md`, without `/`.

![Name box inside docs with example.md typed before Enter is pressed.](/documentation_images/files/copy_path.png)

4. Press **Enter**. The new file becomes selected and opens in the large Git window.

Press **Escape** instead of Enter to cancel before creating the file.

## Troubleshooting

If a file or folder already has the name, an error notification appears and the name box stays open. Choose another name and press Enter. Check that the new file row appears.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): open the new file again.
- [Files sidebar section controls](/documentation/files_sidebar_section_controls): look up the header buttons.
````

### Page `sample_12.md`

Measures: {"pageType":"how-to","lineCount":12,"wordCount":126,"longestParagraphSentences":2,"paragraphRuns":0,"numberedStepCount":3,"bulletCount":2,"tableCount":0,"headingCount":4,"hasTroubleshooting":false,"relatedPageLinkCount":2}

````markdown
# Read a Markdown file
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Show a Markdown file with its formatting.

## Before you start

[Select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace) whose folder is a Git repository. The file must have a Markdown filename such as `README.md`; **Reading** appears only for Markdown files.

## Steps
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/GitModal.vue -->
1. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**.
2. Unfold the containing folders and click the Markdown file row. The file opens in the large Git window.
3. Click **Reading** in the display buttons at the top of the large Git window.

The file is shown with Markdown formatting. The original file is unchanged.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): locate another file.
- [Files sidebar section controls](/documentation/files_sidebar_section_controls): look up row actions.
````

### Page `sample_46.md`

Measures: {"pageType":"reference","lineCount":15,"wordCount":158,"longestParagraphSentences":3,"paragraphRuns":0,"numberedStepCount":0,"bulletCount":2,"tableCount":1,"headingCount":4,"hasTroubleshooting":false,"relatedPageLinkCount":2}

````markdown
# Files sidebar row actions
<!-- generated by docs:update_by_ai -->
<!-- page type: reference -->

Look up the actions available on Files sidebar rows.

## Row actions
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

| Action | Result |
| --- | --- |
| Click a folder row | Selects the folder and folds or unfolds it. |
| Click a file row | Selects the file and opens it in the large Git window. |
| Right-click a file row | Opens the context menu with Copy absolute path and Copy relative path. |
| Right-click a folder row | No path-copy context menu opens. |
| Click empty space outside all rows | Clears the selection for this workspace. |

## Empty folders

Heidrun remembers a new empty folder in the folder tree until Heidrun restarts. After restart, Heidrun deletes the empty folder from disk. Git does not list empty folders.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): open a file.
- [Create a file or folder](/documentation/create_a_file_or_folder): add an item.
````

### Page `sample_73.md`

Measures: {"pageType":"how-to","lineCount":16,"wordCount":203,"longestParagraphSentences":3,"paragraphRuns":0,"numberedStepCount":4,"bulletCount":2,"tableCount":0,"headingCount":5,"hasTroubleshooting":true,"relatedPageLinkCount":2}

````markdown
# Create a file in a folder
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Create an empty file inside an existing folder.

## Before you start

[Select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace) whose folder is a Git repository. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**. Unfold the folders to find the destination folder.

## Steps
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/FilesPanel.vue -->

1. Click the destination folder row to select it. The click also folds or unfolds the folder.
2. Click **New file**, the first button in the Files header. A name box appears inside the selected folder.
3. Type `notes/today.md` to create a folder and a file together. The slash is accepted in the name box.

![Name box inside docs with example.md typed before Enter is pressed.](/documentation_images/files/new_file.png)

4. Press **Enter**. The new file becomes selected and opens in the large Git window.

Press **Escape** instead of Enter to cancel before creating the file.

## Troubleshooting

If a file or folder already has the name, an error notification appears and the name box stays open. Choose another name and press Enter. Check that the new file row appears.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): open the new file again.
- [Files sidebar section controls](/documentation/files_sidebar_section_controls): look up the header buttons.
````

### Page `sample_90.md`

Measures: {"pageType":"how-to","lineCount":12,"wordCount":124,"longestParagraphSentences":2,"paragraphRuns":0,"numberedStepCount":3,"bulletCount":2,"tableCount":0,"headingCount":4,"hasTroubleshooting":false,"relatedPageLinkCount":2}

````markdown
# Read a TypeScript file
<!-- generated by docs:update_by_ai -->
<!-- page type: how-to -->

Show a TypeScript file in Reading mode.

## Before you start

[Select an existing workspace](/documentation/browse_project_files#select-an-existing-workspace) whose folder is a Git repository. Choose a TypeScript file such as `index.ts`; **Reading** is available for every file.

## Steps
<!-- source: docs/agents_rules/user_interface/sidebars/files.md -->
<!-- source: packages/apps/web_frontend/src/components/GitModal.vue -->
1. Click **Files**, the first folder icon in the left sidebar icon bar, above **Scripts**.
2. Unfold the containing folders and click the TypeScript file row. The file opens in the large Git window.
3. Click **Reading** in the display buttons at the top of the large Git window.

The TypeScript file is shown in Reading mode. The original file is unchanged.

## Related pages

- [Browse and open project files](/documentation/browse_project_files): locate another file.
- [Files sidebar section controls](/documentation/files_sidebar_section_controls): look up row actions.
````

## Candidate evaluation context

The supplied pages are independent candidate drafts, not one publication set. Evaluate each candidate independently using ONLY its supplied text and linked images as the candidate content. Virtual filenames identify candidates; they are not files to locate on disk. Do not compare alternative candidates with each other or with on-disk user pages. You may read linked prerequisite sections for context. Set site navigation and consistency to 5 with no site findings because site scoring does not apply to independent candidates; these neutral fields are excluded from the calibration analysis.

Verify facts against real rule/code files and inspect all referenced PNGs. Do not read previous evaluation reports, calibration scripts, expectations, or other calibration artifacts. No edit, Git write, writer, or subagent is permitted. The expected judgements are not supplied to you. Return the specified JSON for exactly the supplied candidate filenames.
