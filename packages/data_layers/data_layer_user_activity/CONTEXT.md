# Directory Context: `/packages/data_layers/data_layer_user_activity`

## Purpose
A Rust library and a command line tool that read the user activity records of the developer from the file `user_activity.jsonl`, and write each one in the table `user_activity_records` of a SQLite file. It is the User activity source of the data layer of Heidrun. The name `data_layer_user_activity` is the name of the package and the name of the executable.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `UserActivityDatabase`, `UserActivityFileReader`, `synchronize`, `to_table`, `to_json`, `default_user_activity_file_path`, `default_database_path`, `validate_user_activity_record_value`, `USER_ACTIVITY_RECORD_SCHEMA` (the text of the JSON schema), and the data types.
- `src/main.rs`: the command line, and the executable. The module `src/command_line.rs` reads its arguments.
- `src/user_activity_file/`: the reading of the file — see its own CONTEXT.md.
- `src/storage/`: the SQLite file, and the text form of the rows of a query — see its own CONTEXT.md.
- `src/model/`: the data types, the JSON schema check, and the conversion of a time to UTC — see its own CONTEXT.md.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the file `user_activity_record.schema.json`. It is the only place that says which fields the database stores.
- `tests/`: the tests of the executable, with a fake file of records. The tests of the library sit at the end of each source file.
- Command to run this folder: `pnpm --silent data_layer:user_activity --help`
- Command to test this folder: `pnpm --filter data_layer_user_activity test`

## Rules
- The table `user_activity_records` has exactly the columns `workspaceFolder`, `startedAt`, `endedAt`, and `data`. The primary key is `workspaceFolder` and `startedAt`, and an index on `endedAt` makes the query "which records overlap this time range" fast. The facts are never split into more columns, and the package writes no link table.
- Every record is checked against its JSON schema before it is written, and a wrong record writes nothing. A line of the file that is not a JSON object that follows the schema is skipped and counted, and never stops a run. An empty line is neither read nor counted.
- `initialize` writes all the rows. `update` writes only the records whose `endedAt` is later than the largest `endedAt` of the table. Each mode can run again and again, and never writes a row two times. A row is never deleted: a record that the web frontend removes from the file stays in the table.
- The times are in UTC, with three digits of milliseconds and the letter `Z`, so two times compare as text. The package converts the offset of the time zone of the file when it reads a line.
- The package never writes the file of the records, and a file that does not exist is not an error. The file is `user_activity.jsonl` in the folder of the variable `HEIDRUN_DIR`, or else in `~/.config/heidrun`, as the desktop application writes it. The option `--file` replaces the whole path.
- The default SQLite file is `~/.config/heidrun/data_layer.sqlite`, shared with the other data layer packages, and `HEIDRUN_DIR` does not change it. The package creates and writes only its own table with `CREATE ... IF NOT EXISTS`. The option `--database` changes the path.
- `query` only works on a database that is open read only, so a query never changes the file and never creates it. The option `--verbose` sends progress lines to a log function, and only `src/main.rs` prints them.
- The folder `src/model/` imports from no other folder of `src/`. The folders `src/user_activity_file/` and `src/storage/` import from `src/model/` only, and never from each other. Only `src/synchronization.rs` uses them together.
- The library calls are blocking. The package imports nothing from another package of the repository, and it knows nothing about Tauri.
- The structure copies `data_layer_source_control`. The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`.

## Background
- The package comes from [issue #474](https://github.com/heidrun-org/heidrun/issues/474). The data layer as a whole is [issue #452](https://github.com/heidrun-org/heidrun/issues/452). The records are described in [the rules of the User activity sidebar section](../../../docs/agents_rules/user_interface/sidebars/user_activity.md).
- A record holds the folder of the workspace, not the name of the repository, and a temporary worktree folder can be deleted. So the package stores `workspaceFolder` only.
- The package does not read the active period that runs now, and it cannot see a record that is lost when the application quits through the menu.
