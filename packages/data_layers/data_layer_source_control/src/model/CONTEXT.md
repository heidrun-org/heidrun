# Directory Context: `/packages/data_layers/data_layer_source_control/src/model`

## Purpose
Holds the facts that the package stores, and the JSON schema check that guards them.

## Key Exports & Entry Points
- `types.rs`: `Commit`, `SynchronizationMode`, `SynchronizationReport`, and `QueryRow`.
- `schemas.rs`: `validate_commit_value`, and the checked conversion `commit_to_checked_value` that `src/storage/database.rs` calls.
- Command to test this folder: `pnpm --filter data_layer_source_control test`

## Rules
- Nothing here imports from `src/git/` or from `src/storage/`.
- The JSON schema file `commit.schema.json` in the folder `schemas/` at the root of the package is the only place that says which fields the database stores. `schemas.rs` holds it inside with `include_str!`, and never restates it.
