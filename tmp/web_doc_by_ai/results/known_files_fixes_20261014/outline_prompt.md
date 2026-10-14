You plan the user documentation of the application Heidrun. You run inside the Git repository of Heidrun. In this pass you DO NOT edit any file: you only read, and you answer with an outline. A second pass writes the pages from your outline.

## Scope

Git history is read only in this process. Never stage files, create or switch branches, write commits, push, merge, or create a pull request or merge request. The developer handles those actions outside this process. Leave generated files uncommitted. Do not run docs:update_by_ai or another documentation writer recursively. Use no subagents. Preserve existing local changes outside the files allowed by this task.

Do a full check of the user documentation. Compare ALL the documentation pages with ALL the current rules and with the code. For each feature of the application, add a page or a section for a new feature, change the section of a changed feature, remove the section of a removed feature, and do nothing for an internal change (refactor, test, build, developer tool). Remove a whole page when all its sections are removed.

The hints at the end only say which parts to look at first. Do not trust the hints as the truth.

## Limit of this run

This run is NOT a full check. Plan and write only the pages for the features that these rule files describe, and the pages that name them as source. Do not add, change, or remove any other page.

- `docs/agents_rules/user_interface/sidebars/files.md`

## Where to read

- The documentation pages are in the folder `packages/auxiliary/website_public/docs/documentation`.
- The rules of the user interface are in the folder `docs/agents_rules/user_interface`, in many small files.
- The glossary is the file `docs/agents_rules/glossary.md`. Use the words of the glossary, and no other word, for each part of the application.
- The code of the application is in the folder `packages/apps`. Read it when a rule is not enough.
- The sidebar of the website is in the file `packages/auxiliary/website_public/docs/.vitepress/config.ts`.

## Source of truth, in this order

1. The rule files in `docs/agents_rules/user_interface` and the glossary. The rules say what the application does now, so a removed feature is also removed from the rules.
2. The code of the application.
3. The pull requests and the issues in the hints. They say what changed and why. They are hints, not the source of truth. You may run `gh issue view <number>` to read an issue.

Write only what the sources show. Never invent a feature. Never write about a feature that no rule or code shows.

## Page types

Each page has exactly ONE type, from the Diátaxis framework (https://diataxis.fr). Never mix two types in one page: a page that mixes steps and descriptions is the main reason why a page is hard to read.

- **tutorial**: a lesson for a new user. A short path of steps that leads to a first success with Heidrun. Only the page `index.md` is a tutorial.
- **how-to**: the steps that solve one task of a person who already uses Heidrun, for example "Copy the path of a file". The title starts with a verb. Most pages are how-to pages.
- **reference**: a dry description to look up, mostly tables: the buttons of a header, the items of a menu, the options of a window. No steps and no story.
- **explanation**: why a feature works the way it does, for example the state "Needs you". Write one only when a person cannot use a feature well without the idea.

### Troubleshooting

A how-to page ends with a section `## Troubleshooting` when the sources show a failure that the reader can meet: an error message, a button that is disabled, something that does not appear, or a change that is lost. Never invent a failure, and leave the section out when the sources show none. Write each problem in this shape:

- A heading of level three that says the symptom as the reader sees it, for example "The name box stays open".
- **Cause**: one sentence.
- **Solution**: numbered steps.
- **Check**: one sentence that says how the reader sees that it works now.

### Related pages

Every page ends with a section `## Related pages`: a bullet list of 2 to 4 links to the other pages that a reader of this page may need next, each with a few words that say why, for example `- [Copy a file path](/documentation/copy_a_file_path): to paste the path in a terminal`. A link starts with `/documentation/` and has no `.md` at the end. Link only to pages that exist after this run.

Organize the pages by what the reader wants to do, not by the rule files. A page can use several rule files, and a rule file can feed several pages: for example, the rule file of a sidebar section can give two how-to pages and one reference page.

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

## Your final answer: the outline

Read the current pages, the rule files, and the glossary first. Then answer with the outline of ALL the pages that must exist after this run, and nothing else, in this form:

```
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
```

Then add one last part "### Sidebar" with the groups and the pages of the sidebar, in order.

Check your outline before you answer: each page has one type and one reader goal, a how-to page holds one task or a few close tasks, and no page restates a rule file.

## Hints

This is the first run. There is no last documented commit, so there are no hints. Do the full check only.

## Resumed task: correct the verified findings

# Verified findings to correct

1. Relative copying uses the Git repository root, not necessarily the workspace folder. With a workspace set to the repository docs subfolder, copying README.md yielded docs/README.md in the notification and in an actual clipboard paste. Correct Copy a file path and Files sidebar section controls. Describe a repository-subfolder example clearly and cite the captured implementation.
2. New workspace… adds the chosen folder to the workspace list without selecting it. An explicit click on the new workspace entry selected the workspace. Browse and open project files must include this step.

These findings come from the prior real native application verification, preserved in ../live_files_verification and ../../process/HANDOFF.md. Do not re-run the application or replace screenshots in this writing run. Keep all existing screenshot assets. Verify claims against the captured source; report any conflict rather than inventing behaviour.

Use only the captured source tree at /Users/jetienne/webwork/heidrun/tmp/web_doc_by_ai/workspace. Git publication is forbidden.
Do not edit source, rules, prompts, tests or unselected pages. Only fix the two known issues.
Do not use subagents. Preserve existing images and page names.
