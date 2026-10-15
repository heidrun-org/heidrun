# Directory Context: `/packages/data_layers/data_layer_user_activity/src/storage`

## Purpose
Holds the SQLite file with the table `user_activity_records`, and writes the rows of a query as text.

## Key Exports & Entry Points
- `database.rs`: `UserActivityDatabase`, which opens the file for writing or read only, writes records, gives the largest `endedAt`, reads one record, and runs a read-only query.
- `query_formatter.rs`: `to_table`, `to_json`, and `NO_ROW_TEXT`.
- Command to test this folder: `pnpm --filter data_layer_user_activity test`

## Rules
- Nothing here imports from `src/user_activity_file/`.
- `database.rs` writes only the table `user_activity_records` and its index, and writes the rows in one transaction, so a wrong record writes nothing.
- `database.rs` creates the table and the index with `CREATE ... IF NOT EXISTS`, and never changes a table of another package that shares the file.
- `database.rs` never deletes a row.
- `query_formatter.rs` only turns rows into text. It reads no file and knows no table.
