# Directory Context: `/scripts/change_log`

## Purpose
The code behind the script `scripts/generate_change_log.ts`: it reads the last release and the merged pull requests from Git, and it writes the texts of the change log in the Keep a Changelog format.

## Key Exports & Entry Points
- `change_log_git.ts`: the class `ChangeLogGit`. It runs `git` to find the last tag, the merged pull requests after it, and the web address of the GitHub repository. It is the only file that runs `git`.
- `change_log_renderer.ts`: the class `ChangeLogRenderer`. It turns data into text only: the mechanical section, the prompt for a coding agent, the clean answer of a coding agent, and the new text of the file `CHANGELOG.md`. It reads nothing and writes nothing.
- `change_log_types.ts`: the type `MergedPullRequest`.
- `test_repository.ts`: creates small temporary Git repositories for the tests. Only the tests import it.
- Command to test this folder: `pnpm test:scripts`

## Rules
- A pull request is a commit whose first line starts with `Merge pull request #`. The folder does not read the GitHub web service.
- The last release is the tag with the highest version number among the tags that the current commit contains.
- The renderer puts the new section above all the older sections, replaces an existing section `## [Unreleased]`, and never changes another older section.
- The default mode never chooses a category. Only a coding agent chooses the categories.
- Nothing here imports the package `raw_coding_agent_cli`: only `scripts/generate_change_log.ts` imports it, and only when the option `--ai` is used.

## Background
- The folder was created by [issue #114](https://github.com/heidrun-org/heidrun/issues/114). The coding agent comes from [issue #113](https://github.com/heidrun-org/heidrun/issues/113).
