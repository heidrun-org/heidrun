# Directory Context: `/packages/data_layers/data_layer_coding_agents/src/model`

## Purpose
Holds the facts that the package stores, and the JSON schema check that guards them.

## Key Exports & Entry Points
- `types.rs`: `ChatSession`, `ChatSessionRelations`, `ChatSessionRecord`, `ModelTokens`, `CodingAgent`, `ChatSessionTable`, `SynchronizationMode`, `SynchronizationReport`, and `QueryRow`.
- `configuration_types.rs`: `ConfigurationKind`, `ConfigurationScope`, `ConfigurationItem`, `ConfigurationRead`, and `ConfigurationWriteCount`, the shapes of the coding agent configuration.
- `schemas.rs`: `validate_chat_session_value`, `validate_configuration_value`, `configuration_schema`, and the checked conversions that `src/storage/` calls.
- Command to test this folder: `pnpm --filter data_layer_coding_agents test`

## Rules
- Nothing here imports from `src/coding_agents/` or from `src/storage/`.
- The JSON schema files in the folder `schemas/` at the root of the package are the only place that says which facts the column `data` stores. `schemas.rs` holds them inside with `include_str!`, and never restates them.
- `ChatSession` holds the facts of the column `data`. `ChatSessionRelations` holds the link tables, and its fields never go into the column `data`.
