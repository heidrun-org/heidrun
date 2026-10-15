# Directory Context: `/scripts`

## Purpose
The scripts that the maintainers run from the root of the repository: the release of the application and the page of shortcuts.

## Key Exports & Entry Points
- `release_dmg.ts`: builds the macOS disk image and uploads it to the GitHub release, twice: with its version in its name, and as `Heidrun_aarch64.dmg`, the file that `install.sh` downloads. Command: `pnpm release:dmg`.
- `shortcuts-readme.mjs`: writes the page of shortcuts of the website. Command: `pnpm docs:shortcuts`.
- `identity-texts.mjs`: writes the title, the motto, and the description of Heidrun from `data/identity.json` into `README.md`, and the description into `AGENTS.md` and `docs/release_notes/prefix.md`. Command: `pnpm docs:identity`.
- `install.sh`: installs the latest Heidrun in `/Applications`, with no macOS message "damaged". The users run it with `curl -fsSL https://raw.githubusercontent.com/heidrun-org/heidrun/main/scripts/install.sh | sh`, so this path never changes. Its tests are the package `packages/dev_tools/install_script_tests`.
- `claude-statusline.sh`: the status line of Claude Code for this repository.

## Rules
- A script that needs its own dependencies, tests, or several files is a full npm package in the folder `packages/dev_tools`, not in this folder. See the `CONTEXT.md` of that folder.
- A script reads the repository from the folder where it runs.
- `install.sh` uses only the commands of macOS and `curl`, and runs with `sh`, because the users pipe it to `sh`.
- `install.sh` downloads only the file `Heidrun_aarch64.dmg` of the latest release, and `release_dmg.ts` must upload that file with every release.

## Background
- `install.sh` comes from [issue #515](https://github.com/heidrun-org/heidrun/issues/515). `curl` puts no quarantine mark on a file, so macOS does not check the signature of the application.
- The change log generator left this folder and went to `packages/auxiliary` in [issue #120](https://github.com/heidrun-org/heidrun/issues/120), and then to `packages/dev_tools` in [issue #226](https://github.com/heidrun-org/heidrun/issues/226). It became a package in [issue #118](https://github.com/heidrun-org/heidrun/issues/118).
