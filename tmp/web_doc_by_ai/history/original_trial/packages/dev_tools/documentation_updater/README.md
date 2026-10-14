# documentation_updater

A command line tool for [Heidrun](../../../README.md). It asks a coding agent to write the user documentation of the public website, in the folder `packages/auxiliary/website_public/docs/documentation`. No person writes a documentation page by hand.

## Command line

Run the command from the root of the repository.

```sh
pnpm docs:update_by_ai                       # generate and check pages; leave files uncommitted
pnpm docs:update_by_ai --dry-run             # print the prompt with the hints; change nothing
pnpm docs:update_by_ai --agent claude        # use claude in place of codex, the default
pnpm docs:update_by_ai --verbose             # show what the coding agent does while it works
pnpm docs:update_by_ai --model gpt-5-codex --effort high   # choose the model and the effort
pnpm docs:update_by_ai --only docs/agents_rules/user_interface/sidebars/files.md   # small trial
```

## What the command does

1. It reads the last documented commit from the file `.last_documented_commit`. On the first run the file does not exist.
2. It collects the hints: the merged pull requests, the issues that they fix, and the diff of the rules since that commit.
3. It starts the coding agent twice. The outline pass reads the pages, the rules, and the code, and plans the pages, each with one page type of the [Diátaxis framework](https://diataxis.fr): tutorial, how-to, reference, or explanation. It edits no file. The writing pass writes the pages from the outline.
4. It writes the current commit in `.last_documented_commit`, then tests the pages: the mark, the page type, the source rule files, and the last documented commit.
5. It runs the tests and the build of the website.
6. It prints the report and the outline, and leaves the generated files uncommitted.

Existing local changes are allowed, so repeated experiments need no commit between runs. The command reads Git history but never stages files, creates or switches branches, writes commits, pushes, merges, or creates a pull request or merge request. The developer handles those actions and publication outside this process.

The writer prompt asks for focused pages with numbered task steps, enough information to find each control, and an expected result or a check. It explains unfamiliar terms, uses consistent names, and links to useful next steps instead of repeating other pages. Tables help readers compare or look up controls and choices. Details and solutions must be supported by the sources.

## The judge

```sh
pnpm docs:judge_by_ai                                  # judge all the generated pages
pnpm docs:judge_by_ai --only copy_a_file_path.md       # judge one page
pnpm docs:judge_by_ai --json > judgement.json          # keep the scores for a comparison
```

The judge reads the pages of the working tree and edits no file. Each page gets mechanical measures (lines, longest paragraph, paragraphs in a row, steps, tables), then a coding agent (`claude` by default, not the writer `codex`) scores it from 1 to 5 on six criteria: task success, usefulness, order, single page type, user language, and accuracy against its source rule files. It also lists the 3 worst problems of each page, and scores the navigation and the consistency of the whole set.

## What it contains

- `src/cli.ts`: the command line of the update.
- `src/judge_cli.ts`: the command line of the judge.
- `src/documentation_judge.ts`: the judge, its prompt, and its report.
- `src/documentation_measures.ts`: the mechanical measures of a page.
- `src/documentation_agent.ts`: the code that runs the coding agent.
- `src/documentation_update.ts`: the steps, in order.
- `src/documentation_hints.ts`: the hints, with no coding agent.
- `src/documentation_prompt.ts`: the prompt for the coding agent.
- `src/documentation_checks.ts`: the tests of the generated pages.
- `src/documentation_git.ts`: reads Git history and records the last documented commit in a local file.
- `src/documentation_paths.ts`: the paths, the mark, and the source comment.
- `tests/`: the Vitest tests.
