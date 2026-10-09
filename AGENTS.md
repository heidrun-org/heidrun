# Project memory

This file is read by Claude Code (through `CLAUDE.md`) and by Codex.

- The branch `dev_jerome` is the personal development branch of Jérôme Étienne. Jérôme's work goes on `dev_jerome`.

## Issue Fix Workflow

Every issue fix in this repository has two parts: the Issue Fix Setup, then the Issue Fix Completion. Between the two parts, you make the change and the developer tests it. Example of an issue fix: remove the folder `docs/issues`.

The Issue Fix Setup starts when the developer asks you to fix an issue, for example "fix the issue 35". The developer gives the number of the issue. If the developer does not give the number, ask for it. Creating the GitHub issue is not a step of the Issue Fix Workflow. See the section "GitHub" for how to create an issue.

### Issue Fix Setup

1. Read the issue.
2. Create a temporary branch, or a temporary worktree, for the fix. Name the temporary branch after the fix and the issue number, for example `remove-docs-issues-35`.
3. Make the change on the temporary branch. Every commit message mentions the issue number.

### Issue Fix Completion

The Issue Fix Completion starts when the developer is satisfied with the change.

1. Make the last commit. It uses `fixes #<issue number>` in its message.
2. Create a pull request from the temporary branch.
3. Merge the pull request into the personal development branch of the developer, for example `dev_jerome`.
4. Delete the temporary branch, locally and on the remote repository. Remove the temporary worktree if one was created.
5. Close the issue.

## GitHub

### Creating an issue

When you create an issue and you have screenshots related to the issue, attach the screenshots to the issue with the `--attach` flag of the `gh` command. The flag takes a file path, and an optional alt text after `#`. Repeat the flag to attach several files.

- When you create the issue: `gh issue create --title "<title>" --body "<body>" --attach './screenshot.png#Alt text'`
- When the issue already exists: `gh issue edit <issue number> --attach './screenshot.png#Alt text'`
