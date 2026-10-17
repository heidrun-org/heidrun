# Directory Context: `/packages/data_layers/heidrun_data`

## Purpose
A Rust library and one command line tool, `heidrun_data`, that give a coding agent the data of the four data layers of Heidrun in one SQLite file, and the `SKILL.md` that teaches a coding agent to use it. It is not a data layer package: it calls the libraries of the four data layer packages, and stores nothing of its own.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. Its `pub use` lines are the list: `Source`, `synchronize`, `lock_database`, `HeidrunDatabase`, `read_catalog`, `data_schema_text`, `read_usage`, the four `read_` functions of the command `read`, `add_limit`, `Format`, `write_rows`, `default_database_path`, and for the request log `read_requests`, `summary_rows`, `list_rows`, `info_row`, `overhead_rows`, `replay_request`, and `make_snapshot`.
- `src/main.rs`: the command line, and the executable `heidrun_data`. The module `src/command_line.rs` reads its arguments and holds the texts of the help.
- `src/usage.rs`: the command `usage`, which reads the tokens and the cost from the SQLite file only.
- `src/requests/` and `src/requests_command_line.rs`: the command `requests` (info, summary, list, replay, snapshot, and overhead), which reads the request log and runs recorded requests again.
- `src/reading/`: the command `read`, the content that the tables do not store — see its own CONTEXT.md.
- `skills/heidrun_data/`: the skill that teaches a coding agent the commands, the tables, and the joins. The folder is standalone: `SKILL.md`, and the folder `references` with the documents that the skill rests on, as links to their place in `docs`. A test compares `SKILL.md` with the help and with the output of `schema`.
- `tests/`: the tests of the executable. The tests of the library sit at the end of each source file.
- Command to run this folder: `pnpm --silent data_layer:heidrun_data --help`
- Command to test this folder: `pnpm --filter heidrun_data test`

## Rules
- All four database defaults follow `HEIDRUN_DIR`; `tests/application_paths.rs` checks development, empty, and unset values in separate processes.
- The four sources are `source_control`, `code_hosting`, `coding_agents`, and `user_activity`: the names of the packages without the prefix `data_layer_`. `update` and `initialize` always run them in this order, whatever the order of the arguments.
- A source that fails does not stop the others. The command prints one error for each source that failed, and exits with the code 1 when at least one source failed.
- `update` and `initialize` call the `synchronize` of each data layer library, never its executable. Only the four data layer packages create and write their tables: this package adds no table and no field.
- `usage` opens the SQLite file read only, never reads a chat session file, and fails with a clear message when the token usage was never read. A model without a price gives a null cost and `isCostComplete` false, never zero. A price list that cannot be fetched is a warning, and not a failure.
- `schema` prints the columns from the tables and the views that the four packages create on a temporary file, and the JSON schemas from the libraries, so this package copies no column and no field. `read` writes nothing and opens no SQLite file.
- `lock_database` is the one lock of the SQLite file: a lock in memory for the threads, and the lock file `<database>.lock` for the other programs. The desktop application and each source of `update` and `initialize` take it before each write, and `update --verbose` prints `waiting for the lock file <path>` when another program holds it.
- `query` and `sources` open the SQLite file read only, so they never change or create it. `query` adds `LIMIT <count>` (default 1000) to a `SELECT`, `WITH`, or `VALUES` statement that has none, and `--limit 0` adds nothing.
- The output is `jsonl`, `json`, or `table`. The default is `table` when the standard output is a terminal, and `jsonl` when it is not. With a JSON format, every error is one JSON object on one line of the standard error output, with the fields `error` and `source`.
- `src/output.rs` only turns rows into text. The code sends the progress lines to a log function and never prints them itself, except `src/main.rs`.
- Every operation of this package records its request with `request_log`, with the package name `heidrun_data`, and the nested requests of the four data layer packages appear under it. `requests` records nothing about itself. A replay of a query or of a `find_*` call opens the SQLite file read only. A replay of a synchronization or of a `refresh_*` call writes only `--isolated-database`, a new file, never the default file, and skips the source `code_hosting` and the price list without `--allow-network` ([rule](../../../docs/agents_rules/data_layer_request_log.md)).
- The calls are blocking. The package knows nothing about Tauri. The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`.

## Background
- The command `requests` and the request log come from [issue #618](https://github.com/heidrun-org/heidrun/issues/618). The command `usage` and the token usage tables come from [issue #616](https://github.com/heidrun-org/heidrun/issues/616).
- The package is the plan of [issue #564](https://github.com/heidrun-org/heidrun/issues/564). `SKILL.md` was tried by a coding agent on this repository.
