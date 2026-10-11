# worktree_tools

Two command line tools for [Heidrun](../../../README.md). They reduce the cost of the Cargo target folder in each Git worktree. Each new worktree has an empty target folder, and its first build compiles every Rust dependency again: it takes 52 to 65 seconds and about 2.5 GB of disk space.

## What it contains

- `src/worktree_create_cli.ts`: the command line `pnpm worktree:create`.
- `src/target_clean_cli.ts`: the command line `pnpm --filter desktop_tauri target:clean`.
- `src/index.ts`: the public interface for another package: the classes `WorktreeCreate` and `TargetClean`.
- `src/worktree_create.ts`, `src/target_clean.ts`: the logic of the two tools.
- `src/worktree_git.ts`: the only code that runs `git`.
- `src/target_paths.ts`: the place of the Cargo target folder inside a checkout.
- `tests/`: the Vitest tests, and a helper that creates temporary Git repositories.

## Create a worktree

Run the command from the root of the repository, or from any worktree.

```sh
pnpm worktree:create fix-thing-12                    # worktree on a new branch, from the current commit
pnpm worktree:create fix-thing-12 --base dev_jerome  # worktree on a new branch, from the branch dev_jerome
```

The command creates the worktree `.claude/worktrees/<name>` of the main checkout, on a new branch with the same name. On macOS, it then clones the folder `packages/apps/desktop_tauri/target/debug` of the main checkout into the worktree, with a copy-on-write clone:

```sh
cp -c -R -p <main checkout>/packages/apps/desktop_tauri/target/debug <worktree>/packages/apps/desktop_tauri/target/debug
```

Measured on 2026-10-11:

- The clone takes 10.8 seconds and 14 MB of real disk space.
- The first build takes 23.4 to 31.8 seconds and about 883 MB, against 52 to 65 seconds and 2.5 GB without the clone.
- A one-character rebuild takes 4.5 to 5.6 seconds, the same as without the clone.

Limits:

- The main checkout must be built first. Without a folder `target/debug`, the command creates the worktree without the clone and says so.
- The clone needs macOS and the Apple File System, with both folders on the same disk. A worktree inside the main checkout is always on the same disk.
- A clone shares its files only at the start. Each file that Cargo rewrites becomes a real copy.

## Clean the old target folders

```sh
pnpm --filter desktop_tauri target:clean                # list the target folders that no build used for 7 days
pnpm --filter desktop_tauri target:clean --days 3       # the same, for 3 days
pnpm --filter desktop_tauri target:clean --yes          # delete them
```

| Option | Effect |
| --- | --- |
| `--days <number>` | The number of days without a build after which a target folder is stale. The default is 7. |
| `--yes` | Delete the stale target folders. Without this option, the command only lists them. |
| `--help` | Shows the description and the options. |

- The age of a target folder is the most recent modification time of any file or folder inside it.
- The command never touches the main checkout.
- The command does not show the size of the folders. The size that `du` shows is too high, because the clones share their blocks.

## Test

```sh
pnpm --filter worktree_tools test    # run the Vitest tests
```
