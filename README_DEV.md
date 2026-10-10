# Heidrun: guide for developers

This document is for the developers who work on Heidrun. It explains four tasks: how to build the application, how to launch the application during development, how to test the application, and how to release the application. The file `README.md` describes the application itself, and the file `AGENTS.md` gives the rules for changes to this repository.

All commands run in the root folder of the repository, on macOS.

## Build the application

You need [Herdr](https://herdr.dev) 0.9 or later, Rust stable, Node.js 20 or later, and [pnpm](https://pnpm.io).

Install the dependencies once, then build:

```bash
pnpm install
pnpm build
```

The command `pnpm build` builds the web frontend, then the Rust backend, then packages both into the application. The result is in `packages/apps/desktop_tauri/target/release/bundle/`:

- `macos/Heidrun.app` is the application. Drag it into `/Applications`.
- `dmg/Heidrun_<version>_<architecture>.dmg` is the disk image.

To build only the web frontend, run `pnpm build:web`.

## Launch the application during development

```bash
pnpm dev
```

The command starts the web frontend with its development server on `http://localhost:1420`, then opens the application window. When you change a file of the web frontend, the window updates without a restart. When you change a Rust file, the command rebuilds the backend and restarts the window.

To work on the web frontend alone, in a browser, run `pnpm dev:web`. Without the application window, the functions of the Rust backend are not available.

## Test the application

```bash
pnpm test
```

The command runs the tests of the five packages, and ends with a non-zero exit code when a test fails. To run the tests of one package:

| Command | Tests |
| --- | --- |
| `pnpm --filter web_frontend test` | The Vitest tests of `packages/apps/web_frontend`. The test files sit next to the code, and are named `*.test.ts`. |
| `pnpm --filter desktop_tauri test` | The `cargo test` tests of `packages/apps/desktop_tauri`. The tests sit in a `#[cfg(test)]` module at the end of each source file. |
| `pnpm --filter website_public test` | The Vitest tests of `packages/auxiliary/website_public`: the configuration, the pages, and a complete build of the website. The test files sit in the folder `tests`. |
| `pnpm --filter raw_coding_agent_cli test` | The Vitest tests of `packages/auxiliary/raw_coding_agent_cli`, with fake `claude` and `codex` commands. The test files sit in the folder `tests`. |
| `pnpm --filter change_log_generator test` | The Vitest tests of `packages/auxiliary/change_log_generator`, the generator of the change log. The test files sit in the folder `tests`. |

When you add a feature, add the matching tests in the same change. When you fix a bug, add a test that fails without the fix.

## Release the application

```bash
pnpm release:dmg
```

The command builds the disk image for macOS and uploads it to the GitHub release of the version in the root `package.json`. The release is named `v<version>`, for example `v0.2.0`. You need the GitHub command line tool `gh`, signed in to an account that can create releases.

Before you run the command:

1. Set the new version in the root `package.json`, in `packages/apps/desktop_tauri/package.json`, in `packages/apps/desktop_tauri/tauri.conf.json`, and in `packages/apps/desktop_tauri/Cargo.toml`.
2. Commit all your changes and push them. The command stops with the command to run when the repository is not in sync with GitHub, because GitHub cannot tag a commit that it does not have.

The text of the release is, in this order:

1. The file `docs/release_notes/prefix.md`. It is the same for every release.
2. The file of the option `--notes-file`, if you give one.
3. The list of changes that GitHub generates from the pull requests.

Options:

| Option | Effect |
| --- | --- |
| `--notes-file <path>` | Adds the text of the Markdown file after the prefix, for example `docs/release_notes/v0.2.0.md`. |
| `--recreate` | Deletes the existing release and its tag, then creates them again on the current commit. The release gets a new date. |
| `--help` | Shows the description of the command and its options. |

When the release already exists and you do not use `--recreate`, the command replaces the disk image and rewrites the text of the release. The release keeps its first date.

The disk image is built for the architecture of your machine only, and it is not signed and not notarized. macOS shows a warning when someone opens it.

## Generate the change log

```bash
pnpm release:change_log
```

The command writes a section of the file `CHANGELOG.md` in the root of the repository, in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, from the pull requests that were merged between two releases. If the file does not exist, the command creates it with the header of the format. The command also prints the new section on the standard output. The command is the package [`packages/auxiliary/change_log_generator`](packages/auxiliary/change_log_generator).

Without option, the section is `Unreleased`: from the last release to the current commit. The last release is the Git tag with the highest version number, for example `v0.2.0`. A pull request is a commit whose first line starts with `Merge pull request #`.

To choose another range, use the options `--from` and `--to`:

| Command | Range | Heading of the section |
| --- | --- | --- |
| `pnpm release:change_log` | last release → now | `## [Unreleased]` |
| `pnpm release:change_log --from v0.2.0` | `v0.2.0` → now | `## [Unreleased]` |
| `pnpm release:change_log --to v0.2.0` | the release before `v0.2.0`, or the start → `v0.2.0` | `## [0.2.0] - <date>` |
| `pnpm release:change_log --from start --to v0.2.0` | the start of the history → `v0.2.0` | `## [0.2.0] - <date>` |
| `pnpm release:change_log --from v0.2.0 --to v0.3.0` | `v0.2.0` → `v0.3.0` | `## [0.3.0] - <date>` |

The date of a release is the date of the commit of its tag. The sections of the file are in this order: `Unreleased` first, then the releases from the highest version to the lowest. The command puts the new section at its place. If the file already has a section with the same version, the command replaces it, so you can run the command again. The other sections never change.

Without `--ai`, the section is a plain list of the merged pull requests, with the title and the link of each one. The command does not choose a category.

Options:

| Option | Effect |
| --- | --- |
| `--from <tag>` | The release after which the changes start. `start` means the start of the history. The default is the release before `--to`, or the start if there is none. |
| `--to <tag>` | The release where the changes end. `now` means the current commit. The default is `now`. |
| `--ai` | A coding agent writes the section, with the categories `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security`. The command sends the messages of the merged pull requests to the package [`raw_coding_agent_cli`](packages/auxiliary/raw_coding_agent_cli). You need `codex` or `claude` installed and signed in. |
| `--agent <name>` | The coding agent for the option `--ai`: `codex` (the default) or `claude`. |
| `--help` | Shows the description of the command and its options. |

The command exits with code 1 and prints an error message when a tag does not exist.

Read the new section before you commit it: a coding agent can make a mistake.
