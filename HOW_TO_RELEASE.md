# How to release Heidrun

This file lists every step of a release of Heidrun, in order, so that no step is forgotten. The file `README_DEV.md` describes each command in detail. The steps come from the release 0.2.5, where several steps were forgotten. The source of this list is the issue [#245](https://github.com/heidrun-org/heidrun/issues/245).

## What the command `pnpm release:dmg` does for you

The command builds the disk image, creates the git tag `v<version>` on the current commit, and creates the GitHub release with the disk image attached. Do not create the git tag by hand.

## Checklist

Replace `<version>` with the new version, for example `0.2.5`.

1. [ ] Run `pnpm test`. The repository has no workflow files in the folder `.github`, so nothing on GitHub runs the tests.
2. [ ] Set the new version in the four files that `README_DEV.md` lists: the root `package.json`, `packages/apps/desktop_tauri/package.json`, `packages/apps/desktop_tauri/tauri.conf.json`, and `packages/apps/desktop_tauri/Cargo.toml`.
3. [ ] Set the new version in the other `package.json` files too: `packages/apps/web_frontend`, `packages/auxiliary/website_public`, `packages/auxiliary/raw_coding_agent_cli`, `packages/dev_tools/change_log_generator`, and `packages/dev_tools/worktree_tools`. The file `README_DEV.md` does not list them. The package `packages/dev_tools/video_recorder` still has the version `0.1.0`: decide if it follows the release version. Commit the file `Cargo.lock` too, because it changes on the next build.
4. [ ] Write the file `docs/release_notes/v<version>.md`, and give it to the command with `--notes-file`. Add one line that says that the disk image is not signed, not notarized, and built only for the architecture of the machine that builds it.
5. [ ] Commit and push. The command stops when the branch is not pushed.
6. [ ] Run `pnpm release:dmg --notes-file docs/release_notes/v<version>.md`. The command always exits with code 0, because the script `release:dmg` in `package.json` ends with `|| true`. Read the output and look for red text.
7. [ ] Run `pnpm release:change_log --to v<version>` after step 6, because the command needs the git tag. Read the new section of `CHANGELOG.md`, then commit and push. For the release 0.2.5, the section `[Unreleased]` was out of date: it stopped at [pull request 119](https://github.com/heidrun-org/heidrun/pull/119), while the last merged pull request was [pull request 244](https://github.com/heidrun-org/heidrun/pull/244).
8. [ ] Know that the text of the GitHub release page does not come from `CHANGELOG.md`. It is the file `docs/release_notes/prefix.md`, then the notes file of step 4, then the list of pull requests that GitHub generates. To publish the change log, push `CHANGELOG.md`.
9. [ ] Open the release page on GitHub. Check that the disk image is attached and that the release is marked Latest. Download the disk image and open it once.
10. [ ] Open a pull request from `dev_jerome` to `main`, and merge it. The git tag stays on its commit, and `main` then contains that commit.

## Open points

- The command `pnpm release:dmg` tags the current commit of the branch that is checked out, and it does not check the branch name.
- The list of files in step 2 and step 3 can be replaced by one command that sets the version everywhere. Create a separate issue if this is wanted.
