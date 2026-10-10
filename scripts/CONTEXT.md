# Directory Context: `/scripts`

## Purpose
The scripts that the maintainers run from the root of the repository: the release of the application, the change log, and the page of shortcuts.

## Key Exports & Entry Points
- `release_dmg.ts`: builds the macOS disk image and uploads it to the GitHub release. Command: `pnpm release:dmg`.
- `generate_change_log.ts`: writes the section `Unreleased` of `CHANGELOG.md`. Command: `pnpm release:change_log`. The test file is `generate_change_log.test.ts`.
- `change_log/`: the code behind `generate_change_log.ts` — see its own CONTEXT.md.
- `shortcuts-readme.mjs`: writes the page of shortcuts of the website. Command: `pnpm docs:shortcuts`.
- `claude-statusline.sh`: the status line of Claude Code for this repository.
- Command to test this folder: `pnpm test:scripts`

## Rules
- A script reads the repository from the folder where it runs, and does not depend on a package of `packages` except `raw_coding_agent_cli`.

## Background
- The tests of the scripts are Vitest files named `*.test.ts`, next to the code, as in the packages.
