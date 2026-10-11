# Directory Context: `/packages/auxiliary/worktree_tools`

## Purpose
A full npm package with two command line tools for Git worktrees. The first tool creates a worktree and clones the compiled Rust files of the main checkout into it. The second tool finds and deletes the Cargo target folders of the worktrees that no build has used for some days.

## Key Exports & Entry Points
- `src/index.ts`: the public interface for another package. It exports the classes `WorktreeCreate` and `TargetClean` and their types.
- `src/worktree_create_cli.ts`: the command line `pnpm worktree:create <name>`, and the executable `worktree_create` of the `bin` entry in `package.json`.
- `src/target_clean_cli.ts`: the command line `pnpm --filter desktop_tauri target:clean`, and the executable `target_clean` of the `bin` entry in `package.json`.
- `src/worktree_git.ts`: the class `WorktreeGit`, the only code that runs `git`.
- `src/target_paths.ts`: the class `TargetPaths`, the only place that knows where the Cargo target folder is inside a checkout.
- `tests/`: the Vitest tests. `tests/test_repository.ts` creates temporary Git repositories, and only the tests import it.
- Command to run this folder: `pnpm worktree:create --help`
- Command to test this folder: `pnpm --filter worktree_tools test`

## Rules
- A worktree is always created inside the folder `.claude/worktrees` of the main checkout, never beside it. That folder is on the same disk as the main checkout, which the clone needs.
- The clone copies only the folder `packages/apps/desktop_tauri/target/debug`, with `cp -c -R -p`, on macOS only. When the clone is not possible, the worktree is still created, and the command says why the clone did not happen.
- The first checkout in the list of `git worktree list` is the main checkout. The cleaning tool never deletes its target folder.
- The cleaning tool deletes nothing without the option `--yes`.
- The age of a target folder is the most recent modification time of any file or folder inside it. The cleaning tool does not show a size, because the clones share their disk blocks and `du` shows a size that is too high.
- The script `target:clean` in the package `desktop_tauri` only runs the command line file of this package. No package in `packages/apps` imports this package.

## Background
- The package was created by [issue #209](https://github.com/heidrun-org/heidrun/issues/209). The compiler cache tools `kache` and `sccache` failed in [issue #203](https://github.com/heidrun-org/heidrun/issues/203).
