# Directory Context: `/packages/auxiliary`

## Purpose
The packages that support the application Heidrun. None of them is the application itself.

## Key Exports & Entry Points
- `change_log_generator/`: a command line tool that writes `CHANGELOG.md` from the merged pull requests. Command: `pnpm release:change_log`. See its own CONTEXT.md.
- `raw_coding_agent_cli/`: a library and a command line tool that send one prompt to `codex` or `claude`. See its own CONTEXT.md.
- `website_public/`: the public website and documentation, built with VitePress. See its own CONTEXT.md.

## Rules
- A package that produces the application goes in `packages/apps`, never here.
- No package in `packages/apps` imports a package from this folder.

## Background
- The folder `packages` was split into `apps` and `auxiliary` in [issue #120](https://github.com/heidrun-org/heidrun/issues/120).
