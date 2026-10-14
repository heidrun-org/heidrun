# Directory Context: `/packages/auxiliary`

## Purpose
The packages that are useful for the application Heidrun, but are not the application itself: a library and the public website. A package that is only a tool for the developers of Heidrun goes in `packages/dev_tools`.

## Key Exports & Entry Points
- `data_layer_code_hosting/`: a Rust library and a command line tool that read the issues and the pull requests of a GitHub repository into two tables of a SQLite file, in the mode initialize or update, and run read-only SQL queries on them. See its own CONTEXT.md.
- `data_layer_source_control/`: a Rust library and a command line tool that read the commits and the merges of a Git repository into a table of the same SQLite file, in the mode initialize or update, and run read-only SQL queries on it. See its own CONTEXT.md.
- `raw_coding_agent_cli/`: a Rust library and a command line tool that send one prompt to `codex`, `claude`, or `agy`. See its own CONTEXT.md.
- `website_public/`: the public website and documentation, built with VitePress. See its own CONTEXT.md.

## Rules
- A package that produces the application goes in `packages/apps`, never here.
- A package that is only a tool for the developers of Heidrun goes in `packages/dev_tools`, never here.
- No package in `packages/apps` imports a package from this folder.
- No package in this folder imports a package from `packages/dev_tools`.

## Background
- The folder `packages` was split into `apps` and `auxiliary` in [issue #120](https://github.com/heidrun-org/heidrun/issues/120).
- The development tools left this folder for `packages/dev_tools` in [issue #226](https://github.com/heidrun-org/heidrun/issues/226).
