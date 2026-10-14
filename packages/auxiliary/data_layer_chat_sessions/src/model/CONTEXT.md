# Directory Context: `/packages/auxiliary/data_layer_chat_sessions/src/model`

## Purpose
Holds the facts that the package stores, and the JSON schema check that guards them.

## Key Exports & Entry Points
- `types.rs`: `ChatSession`, `ChatSessionRelations`, `ChatSessionRecord`, `ModelTokens`, `CodingAgent`, `ChatSessionTable`, `SynchronizationMode`, `SynchronizationReport`, and `QueryRow`.
- `schemas.rs`: `validate_chat_session_value`, and the checked conversion that `src/storage/database.rs` calls.
- Command to test this folder: `pnpm --filter data_layer_chat_sessions test`

## Rules
- Nothing here imports from `src/coding_agents/` or from `src/storage/`.
- The JSON schema file in the folder `schemas/` at the root of the package is the only place that says which facts the column `data` stores. `schemas.rs` holds it inside with `include_str!`, and never restates it.
- `ChatSession` holds the facts of the column `data`. `ChatSessionRelations` holds the link tables, and its fields never go into the column `data`.
