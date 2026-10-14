# Directory Context: `/packages/auxiliary/data_layer_code_hosting/src/storage`

## Purpose
Holds the SQLite file with its two tables, and turns the rows of a query into text.

## Key Exports & Entry Points
- `database.rs`: `CodeHostingDatabase`, which writes the rows, finds a row, and runs a read-only query.
- `query_formatter.rs`: `to_table`, `to_json`, and `NO_ROW_TEXT`.
- Command to test this folder: `pnpm --filter data_layer_code_hosting test`

## Rules
- Nothing here imports from `src/github/`.
- `database.rs` writes an item only after the JSON schema check of `src/model/schemas.rs` accepts it.
- `query` only works on a database that is open read only.
- `query_formatter.rs` only turns rows into text, and never opens the database.
