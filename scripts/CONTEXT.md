# Directory Context: `/scripts`

## Purpose
The scripts that the maintainers run from the root of the repository: the release of the application, the change log, and the page of shortcuts.

## Key Exports & Entry Points
- `release_dmg.ts`: builds the macOS disk image and uploads it to the GitHub release. Command: `pnpm release:dmg`.
- `change_log_generator/`: a full npm package that writes `CHANGELOG.md`. Command: `pnpm release:change_log`. See its own CONTEXT.md.
- `shortcuts-readme.mjs`: writes the page of shortcuts of the website. Command: `pnpm docs:shortcuts`.
- `claude-statusline.sh`: the status line of Claude Code for this repository.

## Rules
- A script that needs its own dependencies, tests, or several files is a full npm package in its own subfolder, listed in `pnpm-workspace.yaml`. It does not spread files in this folder.
- A script reads the repository from the folder where it runs.

## Background
- The change log generator became a package in [issue #118](https://github.com/heidrun-org/heidrun/issues/118).
