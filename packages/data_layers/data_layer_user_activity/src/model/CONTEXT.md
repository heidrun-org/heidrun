# Directory Context: `/packages/data_layers/data_layer_user_activity/src/model`

## Purpose
Holds the facts that the package stores, the JSON schema check that guards them, and the conversion of a time to UTC.

## Key Exports & Entry Points
- `types.rs`: `UserActivityRecord`, `SynchronizationMode`, `SynchronizationReport`, and `QueryRow`.
- `schemas.rs`: `validate_user_activity_record_value`, and the checked conversion `record_to_checked_value` that `src/storage/database.rs` and `src/user_activity_file/user_activity_file_reader.rs` call.
- `utc_time.rs`: `to_utc_text`, which turns a time with a time zone offset into a time in UTC with three digits of milliseconds.
- Command to test this folder: `pnpm --filter data_layer_user_activity test`

## Rules
- Nothing here imports from `src/user_activity_file/` or from `src/storage/`.
- The JSON schema file `user_activity_record.schema.json` in the folder `schemas/` at the root of the package is the only place that says which fields the database stores, and which values `endReason` takes. `schemas.rs` holds it inside with `include_str!`, and never restates it, so `end_reason` is a text and not an enumeration.
