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

The command `pnpm build` builds the web frontend, then the Rust backend, then packages both into the application. The result is in `packages/desktop_tauri/target/release/bundle/`:

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

The command runs the tests of the four packages, and ends with a non-zero exit code when a test fails. To run the tests of one package:

| Command | Tests |
| --- | --- |
| `pnpm --filter web_frontend test` | The Vitest tests of `packages/web_frontend`. The test files sit next to the code, and are named `*.test.ts`. |
| `pnpm --filter desktop_tauri test` | The `cargo test` tests of `packages/desktop_tauri`. The tests sit in a `#[cfg(test)]` module at the end of each source file. |
| `pnpm --filter website_public test` | The Vitest tests of `packages/website_public`: the configuration, the pages, and a complete build of the website. The test files sit in the folder `tests`. |
| `pnpm --filter raw_coding_agent test` | The Vitest tests of `packages/raw_coding_agent`, with fake `claude` and `codex` commands. The test files sit in the folder `tests`. |

When you add a feature, add the matching tests in the same change. When you fix a bug, add a test that fails without the fix.

## Release the application

```bash
pnpm release:dmg
```

The command builds the disk image for macOS and uploads it to the GitHub release of the version in the root `package.json`. The release is named `v<version>`, for example `v0.2.0`. You need the GitHub command line tool `gh`, signed in to an account that can create releases.

Before you run the command:

1. Set the new version in the root `package.json`, in `packages/desktop_tauri/package.json`, in `packages/desktop_tauri/tauri.conf.json`, and in `packages/desktop_tauri/Cargo.toml`.
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
