# Directory Context: `/packages/dev_tools`

## Purpose
The packages that are only tools for the developers of Heidrun. None of them is part of the application, and the application does not need any of them to run.

## Key Exports & Entry Points
- `change_log_generator/`: a command line tool that writes `CHANGELOG.md` from the merged pull requests. Command: `pnpm release:change_log`. See its own CONTEXT.md.
- `video_recorder/`: two command line tools that record a video of the Heidrun window and cut it around its mouse clicks. Commands: `pnpm --filter video_recorder video:record` and `pnpm --filter video_recorder video:cut`. See its own CONTEXT.md.
- `worktree_tools/`: two command line tools: one creates a Git worktree and clones the compiled Rust files into it, the other deletes the old Cargo target folders of the worktrees. Commands: `pnpm worktree:create` and `pnpm --filter desktop_tauri target:clean`. See its own CONTEXT.md.

## Rules
- A package that is only a tool for the developers of Heidrun goes in this folder.
- No package in `packages/apps` and no package in `packages/auxiliary` imports a package from this folder.
- A package in this folder may import a package from `packages/auxiliary`. Example: `change_log_generator` imports `raw_coding_agent_cli`.

## Background
- The three development tools moved here from `packages/auxiliary` in [issue #226](https://github.com/heidrun-org/heidrun/issues/226).
- The package `raw_coding_agent_cli` stays in `packages/auxiliary` because it is a library, and `change_log_generator` imports it.
