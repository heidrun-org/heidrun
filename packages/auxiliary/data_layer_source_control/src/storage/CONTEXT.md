# Directory Context: `/packages/auxiliary/data_layer_source_control/src/storage`

## Purpose
Holds the SQLite file with the table `commits`, and writes the rows of a query as text.

## Key Exports & Entry Points
- `database.rs`: `SourceControlDatabase`, which opens the file for writing or read only, writes commits, lists the known hashes, reads one commit, and runs a read-only query.
- `query_formatter.rs`: `to_table`, `to_json`, and `NO_ROW_TEXT`.
- Command to test this folder: `pnpm --filter data_layer_source_control test`

## Rules
- Nothing here imports from `src/git/`.
- `database.rs` writes only the table `commits`, and writes it in one transaction, so a wrong commit writes nothing.
- `database.rs` creates the table with `CREATE TABLE IF NOT EXISTS`, and never changes a table of another package that shares the file.
- `query_formatter.rs` only turns rows into text. It reads no file and knows no table.
