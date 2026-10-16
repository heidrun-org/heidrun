# Directory Context: `/packages/data_layers/data_layer_coding_agents/src/storage`

## Purpose
Holds the SQLite file with its eight tables, and turns the rows of a query into text.

## Key Exports & Entry Points
- `database.rs`: `ChatSessionsDatabase`, which writes the chat sessions with their link rows, finds a row, and runs a read-only query.
- `configuration_database.rs`: `ConfigurationDatabase`, which writes the tables `memory_files`, `subagents`, and `skills`, and marks a row as removed when its file is gone.
- `query_formatter.rs`: `to_table`, `to_json`, and `NO_ROW_TEXT`.
- Command to test this folder: `pnpm --filter data_layer_coding_agents test`

## Rules
- Nothing here imports from `src/coding_agents/`.
- `database.rs` writes a chat session only after the JSON schema check of `src/model/schemas.rs` accepts it, and it writes the row and its link rows in one transaction. `configuration_database.rs` checks every item of one kind before it writes the first one, and writes them in one transaction.
- `query` only works on a database that is open read only.
- `query_formatter.rs` only turns rows into text, and never opens the database.
