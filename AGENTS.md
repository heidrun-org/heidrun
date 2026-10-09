# Project memory

This file is read by Claude Code (through `CLAUDE.md`) and by Codex.

- The branch `dev_jerome` is the personal development branch of Jérôme Étienne. Jérôme's work goes on `dev_jerome`.

## Modification process

Every modification of this repository follows these seven steps, in this order. Example of a modification: remove the folder `docs/issues`.

1. Create a GitHub issue that says what we try to do. The title of the issue is the modification itself, for example "Remove the docs/issues folder".
2. Create a temporary branch, or a temporary worktree, for the modification. Name the temporary branch after the modification and the issue number, for example `remove-docs-issues-35`.
3. Do the modification on the temporary branch. Every commit message mentions the issue number. The last commit uses `fixes #<issue number>`.
4. Create a pull request from the temporary branch.
5. Merge the pull request into the personal development branch of the developer, for example `dev_jerome`.
6. Delete the temporary branch, locally and on the remote repository. Remove the temporary worktree if one was created.
7. Close the issue.
