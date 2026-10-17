# Directory Context: `/packages/data_layers/data_layer_user_activity`

## Purpose
The User activity source of Heidrun: reads `user_activity.jsonl` into the SQLite table `user_activity_records`. The library and executable are named `data_layer_user_activity`.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface; its `pub use` lines list the readers, databases, synchronization and query functions, schemas, and data types.
- `src/main.rs`: executable; `src/command_line.rs` reads arguments.
- `src/user_activity_file/`: the reading of the file — see its own CONTEXT.md.
- `src/storage/`: the SQLite file, and the text form of the rows of a query — see its own CONTEXT.md.
- `src/model/`: the data types, the JSON schema check, and the conversion of a time to UTC — see its own CONTEXT.md.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `src/refresh.rs`: `refresh_user_activity` imports new records. `src/query.rs`: `find_user_activity_records` reads stored records overlapping a time range.
- `schemas/user_activity_record.schema.json`: the authoritative stored fields.
- `tests/`: executable tests; library tests sit beside their implementation.
- Command to run this folder: `pnpm --silent data_layer:user_activity --help`
- Command to test this folder: `pnpm --filter data_layer_user_activity test`

## Rules
- `user_activity_records` has only `workspaceFolder`, `startedAt`, `endedAt`, and `data`; the primary key is `(workspaceFolder, startedAt)`, with an `endedAt` index and no link table.
- Every record is checked against its JSON schema before it is written, and a wrong record writes nothing. A line of the file that is not a JSON object that follows the schema is skipped and counted, and never stops a run. An empty line is neither read nor counted.
- `initialize` writes all rows; `update` writes records newer than the largest stored `endedAt`. Repeated runs never duplicate rows, and source deletion never deletes stored records.
- Times are UTC text, with three millisecond digits and `Z`; the reader converts source offsets.
- The package never writes the file of the records, and a file that does not exist is not an error. The file is `user_activity.jsonl` in the folder of the variable `HEIDRUN_DIR`, or else in `~/.config/heidrun`, as the desktop application writes it. The option `--file` replaces the whole path.
- The default SQLite file is `data_layer.sqlite` in `HEIDRUN_DIR`, or `~/.config/heidrun/data_layer.sqlite` when the variable is unset or empty, shared with the other data layer packages. The package creates and writes only its own table with `CREATE ... IF NOT EXISTS`. The option `--database` changes the path.
- `query` only works on a database that is open read only, so a query never changes the file and never creates it. The option `--verbose` sends progress lines to a log function, and only `src/main.rs` prints them.
- The folder `src/model/` imports from no other folder of `src/`. The folders `src/user_activity_file/` and `src/storage/` import from `src/model/` only, and never from each other. Only `src/synchronization.rs` uses them together.
- Calls are blocking; the package imports only `request_log` from other repository packages and knows nothing about Tauri. Every public operation records its request and tests its events ([rule](../../../docs/agents_rules/data_layer_request_log.md)).
- `.cargo/config.toml` selects the target folder of `desktop_tauri`, cloned by `pnpm worktree:create`; Cargo reads this configuration only from inside the package.
- Desktop callers use only `refresh_*` and `find_*`, as [data_layer_access.md](../../../docs/agents_rules/data_layer_access.md) requires; `data_layer_boundary_checker` enforces the boundary.

## Background
- The package comes from [issue #474](https://github.com/heidrun-org/heidrun/issues/474). The data layer as a whole is [issue #452](https://github.com/heidrun-org/heidrun/issues/452). The records are described in [the rules of the User activity sidebar section](../../../docs/agents_rules/user_interface/sidebars/user_activity.md).
- A record holds the folder of the workspace, not the name of the repository, and a temporary worktree folder can be deleted. So the package stores `workspaceFolder` only.
- The package does not read the active period that runs now, and it cannot see a record that is lost when the application quits through the menu.
- Request logging follows [request_log](../../auxiliary/request_log/CONTEXT.md).
