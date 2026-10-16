# Directory Context: `/packages/data_layers/heidrun_data`

## Purpose
A Rust library and one command line tool, `heidrun_data`, that give a coding agent the data of the four data layers of Heidrun in one SQLite file. It is not a data layer package: it calls the libraries of the four data layer packages, and stores nothing of its own.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `Source`, `synchronize`, `SynchronizationMode`, `SynchronizationOptions`, `SourceReport`, `HeidrunDatabase`, `SourceSummary`, `add_limit`, `DEFAULT_LIMIT`, `Format`, `write_rows`, `format_error`, `QueryRow`, and `default_database_path`.
- `src/main.rs`: the command line, and the executable `heidrun_data`. The module `src/command_line.rs` reads its arguments and holds the texts of the help.
- `tests/`: the tests of the executable. The tests of the library sit at the end of each source file.
- Command to run this folder: `pnpm --silent data_layer --help`
- Command to test this folder: `pnpm --filter heidrun_data test`

## Rules
- The four sources are `source_control`, `code_hosting`, `chat_sessions`, and `user_activity`: the names of the packages without the prefix `data_layer_`. `update` and `initialize` always run them in this order, whatever the order of the arguments.
- A source that fails does not stop the others. The command prints one error for each source that failed, and exits with the code 1 when at least one source failed.
- `update` and `initialize` call the `synchronize` of each data layer library, never its executable. Only the four data layer packages create and write their tables: this package adds no table and no field.
- `query` and `sources` open the SQLite file read only, so they never change the file and never create it. `sources` reports 0 rows when the file does not exist.
- `query` adds `LIMIT <count>` (default 1000) to a `SELECT`, `WITH`, or `VALUES` statement that has no `LIMIT`, and `--limit 0` adds nothing.
- The output is `jsonl`, `json`, or `table`. The default is `table` when the standard output is a terminal, and `jsonl` when it is not. With a JSON format, every error is one JSON object on one line of the standard error output, with the fields `error` and `source`.
- `src/output.rs` only turns rows into text. The code sends the progress lines to a log function and never prints them itself, except `src/main.rs`.
- The calls are blocking. The package knows nothing about Tauri. The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`.

## Background
- The package is the step 1 of the plan of [issue #564](https://github.com/heidrun-org/heidrun/issues/564). The commands `schema` and `read`, the lock of the SQLite file, and the `SKILL.md` are later steps of the same plan.
