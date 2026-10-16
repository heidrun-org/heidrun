# Directory Context: `/packages/data_layers`

## Purpose
The data layer packages of Heidrun. Each package reads the facts of one source into tables of a SQLite file, in the mode initialize or update, and runs read-only SQL queries on them.

## Key Exports & Entry Points
- `data_layer_code_hosting/`: a Rust library and a command line tool that read the issues and the pull requests of a GitHub repository into two tables of a SQLite file, in the mode initialize or update, and run read-only SQL queries on them. See its own CONTEXT.md.
- `data_layer_source_control/`: a Rust library and a command line tool that read the commits and the merges of a Git repository into a table of the same SQLite file, in the mode initialize or update, and run read-only SQL queries on it. See its own CONTEXT.md.
- `data_layer_user_activity/`: a Rust library and a command line tool that read the user activity records of the developer from the file `user_activity.jsonl` into a table of the same SQLite file, in the mode initialize or update, and run read-only SQL queries on it. See its own CONTEXT.md.
- `data_layer_coding_agents/`: a Rust library and a command line tool that read the chat sessions of Claude Code and of Codex for a repository, and the configuration of the coding agent (the memory files, the subagents, and the skills), into a SQLite file, in the mode initialize or update, and run read-only SQL queries on them. The desktop application uses the library to find and read the chat session files. See its own CONTEXT.md.
- `heidrun_data/`: not a data layer package. A Rust library and one command line tool, for a coding agent, that call the libraries of the four data layer packages: `update`, `initialize`, `sources`, `schema`, `query`, and `read`. See its own CONTEXT.md.

## Rules
- Every data layer package goes in this folder, and the name of its folder starts with `data_layer_`.
- `heidrun_data` is the only package here that is not a data layer package. Every other package that is not a data layer package goes in `packages/apps`, `packages/auxiliary`, or `packages/dev_tools`, never here.
- No data layer package imports another data layer package: the packages share only the SQLite file. `heidrun_data` is the only package that imports more than one of them, and no data layer package imports `heidrun_data`.

## Background
- The three data layer packages moved here from `packages/auxiliary` in [issue #470](https://github.com/heidrun-org/heidrun/issues/470). The data layer as a whole is [issue #452](https://github.com/heidrun-org/heidrun/issues/452). The package `heidrun_data` is the plan of [issue #564](https://github.com/heidrun-org/heidrun/issues/564).
