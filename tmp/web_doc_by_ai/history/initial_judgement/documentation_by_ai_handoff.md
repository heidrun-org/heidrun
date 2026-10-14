# Handoff: the user documentation of Heidrun, written and judged by AI

This document gives another coding agent everything it needs to continue the work on [issue 375](https://github.com/heidrun-org/heidrun/issues/375) of the repository [heidrun-org/heidrun](https://github.com/heidrun-org/heidrun). Read all of it before you change anything.

## 1. The goal

Heidrun is a desktop application (Tauri, with a web frontend) that keeps several coding agents working and shows which one needs the person. The repository also holds a public website, built with VitePress, in the folder `packages/auxiliary/website_public`. The user documentation of the website is in `packages/auxiliary/website_public/docs/documentation/`.

The goal of issue 375: the user documentation is written entirely by AI. No person writes or edits a documentation page by hand.

- When a feature is added, a section for the feature appears in the documentation.
- When a feature is removed, its section disappears.
- When a feature changes, its section changes.

The developer runs one command when the documentation must be up to date. Every run is a full check of all the documentation against all the current rules and code. The commits since the last run are only hints that say which parts to look at first.

The new goal, after the first trials: the pages must be good to read, not only correct. The owner of the project judged the first generated page "indigestible and useless", and the second "better, but far from great". So the work now has two parts:

1. The writer: a command that generates the pages.
2. The judge: a command that scores the quality of the pages, so the prompt of the writer can be improved, later in a learning loop.

## 2. Where the work is

- The main checkout: `/Users/jetienne/webwork/heidrun`, on the branch `dev_jerome`.
- The work is in a temporary Git worktree: `/Users/jetienne/webwork/heidrun/.claude/worktrees/generate-docs-with-ai-375`, on the branch `generate-docs-with-ai-375`. It has 9 local commits, each one mentions `#375`. Nothing is pushed yet. No pull request exists yet.
- Two local branches hold the results of two trial runs: `update-documentation-by-ai-83ffd0b` (one page `files.md`, the second trial) and `update-documentation-by-ai-9ebe6c3` (three pages: `copy_a_file_path.md`, `create_a_file_or_folder.md`, `files_sidebar.md`, and a changed `index.md`; the third trial). Keep them for comparison. Never merge them into `generate-docs-with-ai-375`.
- Work only inside the worktree. Never edit the main checkout.

## 3. What exists now

### 3.1 The package `documentation_updater`

A new package in `packages/dev_tools/documentation_updater`, with two commands at the root of the repository:

- `pnpm docs:update_by_ai`: the writer.
- `pnpm docs:judge_by_ai`: the judge.

The source files, in `src/`:

- `cli.ts`: the command line of the writer.
- `judge_cli.ts`: the command line of the judge.
- `documentation_update.ts`: the class `DocumentationUpdate`, the steps of the writer, in order.
- `documentation_prompt.ts`: the class `DocumentationPrompt`, the two prompts of the writer (the outline prompt and the writing prompt). This is the file to improve for a better quality.
- `documentation_judge.ts`: the class `DocumentationJudge`, the prompt of the judge, the reading of its JSON answer, the mean scores, and the Markdown report.
- `documentation_judge_types.ts`: the Zod schema `JUDGE_ANSWER_SCHEMA` of the answer of the judge, and the types of the judge.
- `documentation_measures.ts`: the class `DocumentationMeasures`, the mechanical measures of a page, with no coding agent.
- `documentation_checks.ts`: the class `DocumentationChecks`, the hard tests of the generated pages.
- `documentation_hints.ts`: the class `DocumentationHints`, which collects the hints between two commits, with no coding agent.
- `documentation_git.ts`: the class `DocumentationGit`, the `git` and `gh` commands.
- `documentation_agent.ts`: the class `DocumentationAgent`, the only code that imports the package `raw_coding_agent_cli`.
- `documentation_paths.ts`: the class `DocumentationPaths`, the only place that knows the paths, the mark, and the comment patterns.
- `documentation_types.ts`: the types of the writer.
- `index.ts`: the public interface of the package.

The tests are in `tests/` (Vitest, 34 tests). `tests/test_repository.ts` creates temporary Git repositories. Run them with `pnpm --filter documentation_updater test`.

### 3.2 Changes in other packages

- `packages/auxiliary/raw_coding_agent_cli`: the class `RawCodingAgent` (which sends one prompt to `claude -p` or `codex exec` through the standard input) has new options:
  - `workingDirectory`: the folder where the coding agent runs.
  - `isEditAllowed`: `claude` gets `--permission-mode acceptEdits` and the read-only commands `git log`, `git diff`, `git show`, and `gh issue view`; `codex` gets `--sandbox workspace-write`.
  - `onProgress`: `claude` then runs with `--output-format stream-json --verbose`, and each event becomes one progress line; `codex` sends the lines of its standard error output.
  - `model`: both commands get `--model`.
  - `effort`: `claude` gets `--effort`, `codex` gets `-c model_reasoning_effort="<effort>"`.
- `packages/dev_tools/change_log_generator`: its `src/index.ts` now also exports `ChangeLogGit` and the types `ChangeLogRange` and `MergedPullRequest`. The writer uses them to list the merged pull requests.
- `packages/auxiliary/website_public/tests/pages.test.ts`: the test no longer expects exactly four pages; it expects that the four fixed pages exist.
- `packages/auxiliary/website_public/docs/documentation/index.md`: still a placeholder, with the mark and the page type `tutorial`.
- The root `package.json`, `AGENTS.md`, `README.md`, `README_DEV.md`, `HOW_TO_RELEASE.md`, and the `CONTEXT.md` files of the touched folders are updated.

### 3.3 The writer: `pnpm docs:update_by_ai`

The steps:

1. It reads the last documented commit from the file `packages/auxiliary/website_public/docs/documentation/.last_documented_commit`. On the first run the file does not exist, and there are no hints.
2. It collects the hints between that commit and `HEAD`: the merged pull requests (the commits whose subject starts with `Merge pull request #`), the issues that the commits fix (`fixes #12`, `closes #12`, `resolves #12`), the changed files in `docs/agents_rules/user_interface`, the glossary, and `packages/apps`, and the diff of the rules (cut at 60000 characters).
3. It refuses to run when the working tree has uncommitted changes, so the pull request holds only the documentation.
4. Pass 1, the outline pass: the coding agent reads the pages, the rules, and the code, edits no file, and answers with an outline of all the pages: for each page the action (add, change, keep, remove), the page type, the title, the reader goal, the sources, the sections, the troubleshooting symptoms, the related pages, and what to leave out. Then the groups of the sidebar.
5. Pass 2, the writing pass: the coding agent writes the pages from the outline, and updates the sidebar in `packages/auxiliary/website_public/docs/.vitepress/config.ts`. It answers with a report: three lists "Added", "Changed", "Removed".
6. The command writes the current commit into `.last_documented_commit`, except in a run limited with `--only`, because that run is not a full check.
7. It runs the hard tests of the pages (section 3.5).
8. It runs `pnpm --filter website_public test` and `pnpm --filter website_public build`.
9. It makes the branch `update-documentation-by-ai-<short commit>` and a commit. Without `--no-pull-request`, it pushes the branch and runs `gh pr create`, with the report and the outline in the body.

The options:

| Option | Effect |
| --- | --- |
| `--agent <name>` | `codex` (the default) or `claude`. |
| `--model <name>` | The model of the coding agent. Without it, the settings of the coding agent decide. Today `codex` uses `gpt-6-luna`. |
| `--effort <level>` | The effort level, for example `low`, `medium`, `high`. Without it, the settings decide. Today `codex` uses `medium`. |
| `--only <path...>` | Limits the run to the features of these rule files, for a small trial. Does not write `.last_documented_commit`. |
| `--no-pull-request` | Stops after the local commit. Nothing is pushed. |
| `--verbose` | Shows what the coding agent does while it works. |
| `--dry-run` | Prints the two prompts and stops. Runs no coding agent and changes nothing. |

The command prints "Step 1 of 5" to "Step 5 of 5", and a line every 30 seconds while the coding agent runs.

### 3.4 What the writing prompt asks

The full text is in `src/documentation_prompt.ts`. In short:

- **Sources of truth, in this order**: the rule files in `docs/agents_rules/user_interface` and the glossary `docs/agents_rules/glossary.md`; then the code in `packages/apps`; then the pull requests and the issues, which are only hints. Never invent a feature.
- **Page types of the Diátaxis framework** (https://diataxis.fr): each page has exactly one type: `tutorial` (only `index.md`, the "Get started" lesson), `how-to` (one task, the title starts with a verb; most pages), `reference` (tables to look up), `explanation` (rare). Organize the pages by what the reader wants to do, not by the rule files.
- **Style**: for a person who uses Heidrun, not for a developer; never restate a rule file; one sentence at the start that says what the reader gets; numbered steps with one action each; names of buttons in bold; tables for groups of buttons or options; at most three sentences in a paragraph, and never two paragraphs in a row without a heading, a list, or a table; no internal details (where a choice is saved, caches, needless defaults, rare edge cases); about 30 lines a page.
- **Troubleshooting**: a how-to page ends with `## Troubleshooting` only when the sources show a failure. Each problem: a heading of level three with the symptom, then **Cause**, **Solution** (numbered steps), and **Check**.
- **Related pages**: every page ends with `## Related pages`, a list of 2 to 4 links such as `- [Copy a file path](/documentation/copy_a_file_path): to paste the path in a terminal`.
- **Marks in the files**: after the title, the comment `<!-- generated by docs:update_by_ai -->`, then `<!-- page type: how-to -->`. Under every heading of level two except "Related pages", a comment `<!-- source: <path> -->` that names a rule file, or a code file when a fact comes only from the code.
- **Sidebar**: one group for each page type, in this order: "Get started", "How-to guides", "Reference", "Explanation". The page `shortcuts.md` goes in "Reference".
- **Files that the coding agent must not edit**: `shortcuts.md` (generated by `pnpm docs:shortcuts`) and `.last_documented_commit`. It edits only the documentation folder and the sidebar file.
- **VitePress limits**: no raw angle bracket outside code, because VitePress reads `<name>` as a Vue tag and the build fails; no tab character; each paragraph on one line.

### 3.5 The hard tests

They run in the writer after the coding agent, and in the Vitest tests on the real repository:

- Every Markdown page of the documentation folder, except `shortcuts.md`, has the mark.
- Every such page has a comment `<!-- page type: ... -->` with one of the four types.
- Every comment `<!-- source: ... -->` names a file that exists.
- `.last_documented_commit` is an ancestor of `HEAD`, when the file exists.
- In the package `website_public`: every link to `/documentation/...` points to a page that exists, every sidebar link has a page, each page has one title of level one, no tab character, and the VitePress build passes.

### 3.6 The judge: `pnpm docs:judge_by_ai`

The judge reads the generated pages of the working tree and edits no file. Its default coding agent is `claude`, so it differs from the default writer `codex` and does not praise its own style.

1. **Mechanical measures** of each page, free and exact: the page type, the number of lines and words, the sentences of the longest paragraph, the number of times a paragraph follows another paragraph with nothing between them, the lines of numbered steps and of bullets, the tables, the headings, whether the page has a section "Troubleshooting", and the number of links in "Related pages".
2. **The rubric**: the coding agent scores each page from 1 to 5 on six criteria:
   - `taskSuccess`: a new user can do the task from this page alone; a failure shown by the sources needs a troubleshooting section.
   - `usefulness`: every sentence helps.
   - `order`: the order in which the reader needs it.
   - `singleType`: the page keeps to its one page type.
   - `userLanguage`: written for a user, with the words of the glossary.
   - `accuracy`: the named sources support every claim; an unsupported claim gives at most 2.
   It lists the 3 worst problems of each page, each one concrete, and one sentence of verdict. It also scores the whole set on `navigation` (the sidebar and the related pages) and `consistency`.
3. **Calibration**: the prompt holds the two verdicts of the owner of the project as anchors: "indigestible and useless" is 1, and "better, but far from great" is about 3.
4. **Output**: a Markdown report with a table of scores and measures, or JSON with `--json`, for a comparison between runs. The overall score is the mean of the page means and of the two site scores.

The options: `--agent`, `--model`, `--effort`, `--only <file...>` (page file names), `--json`, `--verbose`, `--dry-run`.

## 4. What happened in the trials

All the trials used `codex` and `--only docs/agents_rules/user_interface/sidebars/files.md`.

1. **First trial**, the first prompt: one page `files.md`, a wall of text that restated the rule file, with defaults and edge cases. The owner: "ugly and useless", "indigestible". This led to the style rules.
2. **Second trial**, with the style rules: one page with headings and numbered steps. The owner: "better, far from great". This led to the outline pass and the page types.
3. **Third trial**, with the outline pass, the page types, and the effort `high`: three pages (two how-to pages and one reference page) and a changed `index.md`. The judge scored it **3.8 out of 5**:

| Page | Type | Mean | Main problem found by the judge |
| --- | --- | --- | --- |
| `copy_a_file_path.md` | how-to | 4.5 | It does not say that a folder row has no right-click menu, or that a message shows the copied path. |
| `create_a_file_or_folder.md` | how-to | 4.3 | Step 2 mixes the action and a fallback; the error cases are missing. |
| `index.md` | tutorial | 3.7 | It is not a real lesson: no start state, no visible result, no link to the next pages. |
| `files_sidebar.md` | reference | 3.5 | It claims that a dot marks a folder with changes, which no rule file says; it leaves out the right-click menu. |

Site: navigation 3, consistency 4. The pages did not link to each other, and the words "workspace" and "the large Git window" were never explained to a new user. These findings led to the sections "Related pages" and "Troubleshooting", and to source comments that may name a code file.

No trial has run yet with the last prompt (troubleshooting and related pages).

## 5. What is not done yet

1. **The learning loop.** The plan agreed with the owner:
   1. Write the pages from a fixed set of 3 or 4 rule files.
   2. Judge them.
   3. Ask a coding agent to propose a change to the style parts of the prompt, from the problems found by the judge.
   4. Write the pages again with the changed prompt, and judge them again.
   5. Keep a change only when the score goes up. Stop after 3 rounds.
   6. A person approves the final change of the prompt. The loop never commits a prompt change by itself, because a loop without a person learns to please the judge and not the reader.
   Things to decide: where the prompt parts that the loop may change are kept (today they are TypeScript text in `documentation_prompt.ts`), how to run the writer without making a branch and a commit for each round, and how to restore the pages between rounds.
2. **Navigation of the website**: the local search of VitePress (`themeConfig.search: { provider: 'local' }` in `config.ts`) is not on. The table of contents on each page exists by default.
3. **Visual design of the website**: a theme with a clear identity, typography, light and dark themes. This is work done once by hand, outside the AI loop, and it deserves its own issue.
4. **Accessibility tests** of the website are missing.
5. **Screenshots** in the documentation: none yet. Heidrun must start with `--no-splash-screen` for a screenshot.
6. **GitLab**: the writer runs `gh pr create`. The rule of the repository says that every support of GitHub needs the same support of GitLab (`glab mr create`). It is not done yet, and it is written in the `CONTEXT.md` of the package.
7. **The end of the issue**: the Issue Fix Completion (section 6.1) is not done.

## 6. Rules of the repository that you must follow

Read `AGENTS.md` at the root of the repository, and the `CONTEXT.md` of every folder that you change. The main rules:

### 6.1 Issue Fix Workflow

- Every fix is made in a temporary worktree created with `pnpm worktree:create <name>` from the main checkout, never with `git worktree add`, and never in the main checkout. This work already has its worktree (section 2).
- Every commit message mentions the issue number (`#375`). The last commit uses `fixes #375`.
- The end: make a pull request from `generate-docs-with-ai-375` into `dev_jerome`, merge it, delete the temporary branch locally and on the remote, remove the worktree, and close the issue. Do it only when the developer says that the work is done.
- **Never delete the branches `dev`, `dev_jerome`, or `dev_eric`.** Never pass `--delete-branch` to `gh pr merge` for them.
- Commit or push only when the developer asks. Never add an attribution line for an AI to a commit message or a pull request.

### 6.2 Language

- Write in ASD-STE100 Simplified Technical English: plain words, short sentences.
- Never abbreviate and never shorten a name. When something is called "Files sidebar section", write "Files sidebar section" every time, never "Files" alone and never a synonym. Use the words of `docs/agents_rules/glossary.md`.
- Never use the word "gate"; write "test".
- Answer the developer in short answers: the direct answer first, at most a few lines, no recap.

### 6.3 Code style (TypeScript)

- Tabs for indentation, single quotes, semicolons, trailing commas, lines of at most 120 characters.
- Every `if`, `else`, `for`, and `while` has braces, with the body on its own line.
- Never `!value` in a condition: write `=== false`, `=== null`, `=== undefined`.
- Every function is in a class: a static class named after the file (`documentation_judge.ts` holds `class DocumentationJudge`). Private methods start with `_` and come last, after a section separator.
- JSDoc on every class, every type, every field, and every method, with `@param` and `@returns`.
- Named exports only. Node built-in modules are imported as a whole: `import Fs from 'node:fs'`.
- Zod for the data shapes that come from outside, such as the answer of a coding agent.
- A section separator is two lines of 79 `/`, a line `//<tab>Title`, and two lines of 79 `/`.

### 6.4 Tests and documents

- When you add a feature, add its tests in the same change. When you fix a bug, add a test that fails without the fix.
- `pnpm test` at the root runs every package. The tests of this work: `pnpm --filter documentation_updater test`, `pnpm --filter raw_coding_agent_cli test`, `pnpm --filter website_public test`.
- Keep each `CONTEXT.md` under 5500 bytes. It states rules in the present tense, and links to the issue for the history.
- When you change the behavior of a command, update `README_DEV.md`, the `README.md` of the package, and its `CONTEXT.md`.

### 6.5 Traps already met

- **Never run two commands that write the documentation at the same time in the same worktree**, and never commit while a run of the writer is still going. One full run wrote 5 pages while a commit was made, and `git add -A` put them into an unrelated commit.
- The writer switches the worktree to its new branch `update-documentation-by-ai-...` at the end of a run. Before you change code, run `git switch generate-docs-with-ai-375`.
- `claude -p` prints nothing until it ends. Use `--verbose` to see its progress.
- An agent that does not get the permission to edit cannot write the pages: the writing pass needs `isEditAllowed: true`, the outline pass and the judge must have `false`.

## 7. Useful commands

All the commands run in the worktree:

```bash
cd /Users/jetienne/webwork/heidrun/.claude/worktrees/generate-docs-with-ai-375
```

```bash
git switch generate-docs-with-ai-375
```

```bash
pnpm --filter documentation_updater test
```

```bash
pnpm docs:update_by_ai --dry-run --only docs/agents_rules/user_interface/sidebars/files.md
```

```bash
pnpm docs:update_by_ai --verbose --no-pull-request --only docs/agents_rules/user_interface/sidebars/files.md
```

```bash
pnpm docs:judge_by_ai
```

```bash
pnpm docs:judge_by_ai --json
```

```bash
pnpm --filter website_public dev
```

The website then opens at http://localhost:5173/heidrun/documentation/.

## 8. What to do first

1. Read `AGENTS.md`, `docs/agents_rules/glossary.md`, `packages/dev_tools/documentation_updater/CONTEXT.md`, and `src/documentation_prompt.ts`.
2. Run `pnpm --filter documentation_updater test` to see that everything passes.
3. Run the small trial and the judge (section 7) with the last prompt, and compare the score with 3.8.
4. Then ask the developer which next step to take: the learning loop, the search of the website, or the visual design.
