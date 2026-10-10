# Directory Context: `/packages/auxiliary/change_log_generator/src/git`

## Purpose
Reads the releases and the merged pull requests from the Git repository.

## Key Exports & Entry Points
- `change_log_git.ts`: the class `ChangeLogGit`. It finds the root folder of the repository, the last release before a commit, the date of a release, the merged pull requests of a range, and the web address of the GitHub repository.

## Rules
- This is the only folder that runs `git`.
- Nothing here imports from `rendering/` or `generation/`.

## Background
- The folder was created by [issue #114](https://github.com/heidrun-org/heidrun/issues/114), and the ranges come from [issue #118](https://github.com/heidrun-org/heidrun/issues/118).
