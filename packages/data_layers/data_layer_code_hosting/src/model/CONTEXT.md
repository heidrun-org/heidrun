# Directory Context: `/packages/data_layers/data_layer_code_hosting/src/model`

## Purpose
Holds the facts that the package stores, and the JSON schema checks that guard them.

## Key Exports & Entry Points
- `types.rs`: `Issue`, `PullRequest`, their state enums, `CodeHostingTable`, `SynchronizationMode`, `SynchronizationReport`, and `QueryRow`.
- `schemas.rs`: `validate_issue_value`, `validate_pull_request_value`, and the checked conversions that `src/storage/database.rs` calls.
- Command to test this folder: `pnpm --filter data_layer_code_hosting test`

## Rules
- Nothing here imports from `src/github/` or from `src/storage/`.
- The two JSON schema files in the folder `schemas/` at the root of the package are the only place that says which fields the database stores. `schemas.rs` holds them inside with `include_str!`, and never restates them.
