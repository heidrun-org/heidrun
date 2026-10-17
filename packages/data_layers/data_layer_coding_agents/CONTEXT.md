# Directory Context: `/packages/data_layers/data_layer_coding_agents`

## Purpose
A Rust library and a command line tool that read the chat sessions that Claude Code and Codex saved for a repository, and the coding agent configuration (the memory files, the subagents, and the skills), and write the facts of each one in a SQLite file. They also store the tokens that each chat session used in each minute, the prices of the models, and the estimated cost in US dollars. The desktop application uses the library through `refresh_chat_sessions`, `refresh_ai_cost`, `refresh_public_model_prices_when_due`, `find_chat_list`, and `find_ai_cost`.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. Its `pub use` lines are the list: the readers, the databases `ChatSessionsDatabase`, `ConfigurationDatabase`, `TokenUsageDatabase`, and `ModelPriceDatabase`, `synchronize`, `synchronize_configuration`, and `synchronize_token_usage`, `usage_query_from_parameters` (the question about the usage that a recorded request holds, for the replay of the request log), the JSON schemas, and the data types.
- `src/main.rs` and `src/command_line.rs`: the executable `data_layer_coding_agents`.
- `src/refresh.rs` and `src/query.rs`: the `refresh_*` functions copy the chat sessions, the tokens, and the prices into the SQLite file, with one scan cache `chats_cache.json` next to it. `find_chat_list` and `find_ai_cost` read the SQLite file only and give typed rows. A query on a file that has no table of this package gives an empty answer.
- `src/coding_agents/`: the reading of the chat session files, of the tokens, and of the configuration — see its own CONTEXT.md.
- `src/storage/`: the SQLite file, and the text form of the rows of a query — see its own CONTEXT.md.
- `src/pricing/`: the price list of the models, and the calculation of a cost — see its own CONTEXT.md.
- `src/model/`: the data types, and the JSON schema check — see its own CONTEXT.md.
- `src/repository_finder.rs`: the root and the repository `owner/name` of a folder.
- `src/synchronization.rs`: the two modes, `initialize` and `update`, for the configuration and for the token usage.
- `schemas/`: one JSON schema file for each table that has a column `data`.
- `tests/`: the tests of the executable. The tests of the library sit at the end of each source file.
- Command to run this folder: `pnpm --silent data_layer:coding_agents --help`
- Command to test this folder: `pnpm --filter data_layer_coding_agents test`

## Rules
- `chat_sessions` has exactly the columns `repository`, `id`, `updatedAt`, and `data`, with four link tables. A relation is never copied into `data`. The tables `memory_files`, `subagents`, and `skills` have the same four columns, and a row whose file is gone stays, with the date in `removedAt`.
- Every row with a column `data` is checked against its JSON schema before it is written. The program holds the schema files inside with `include_str!`.
- `initialize` reads every file. `update` reads the files that changed at the date of the last read or later. Each mode can run again and again, and never writes a row two times.
- The package stores facts only: no message text, and no body of a memory file, a subagent, or a skill. It never writes in the folders of the coding agents.
- `token_usage_minutes` has one row for each chat session, model, and minute in UTC. The cost is never stored: the view `token_usage_with_cost` calculates it, and an unknown price gives a null cost, never zero. The rules are in `docs/statistics/token_usage_and_cost.md`.
- `query` only works on a database that is open read only.
- `src/model/` imports from no other folder of `src/`. `src/coding_agents/` and `src/pricing/` import from `src/model/` only. `src/storage/` imports from `src/model/` and `src/pricing/`. Only `src/synchronization.rs` uses all of them together.
- Only `src/repository_finder.rs` runs the command `git`. Only `src/coding_agents/agent_homes.rs` reads the variables `CLAUDE_CONFIG_DIR` and `CODEX_HOME`, and the home folder for `~/.agents`.
- The library calls are blocking. The package imports only `request_log` from the other packages of the repository, and it knows nothing about Tauri. Every public operation records its request with `request_log::record`, a new operation does the same in the same change, and its test reads the events ([rule](../../../docs/agents_rules/data_layer_request_log.md)).
- The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`, the one folder that `pnpm worktree:create` clones.
- The desktop application calls only the functions `refresh_*` and `find_*` of this package, as [data_layer_access.md](../../../docs/agents_rules/data_layer_access.md) says. The test of the package `data_layer_boundary_checker` fails otherwise.

## Background
- The package comes from [issue #463](https://github.com/heidrun-org/heidrun/issues/463). It was named `data_layer_chat_sessions` until [issue #569](https://github.com/heidrun-org/heidrun/issues/569). The data layer as a whole is [issue #452](https://github.com/heidrun-org/heidrun/issues/452).
- The token usage and the prices come from [issue #616](https://github.com/heidrun-org/heidrun/issues/616).
- The relation "people" is not written, because no text of a chat session names a person ([issue #463](https://github.com/heidrun-org/heidrun/issues/463)).
- The request log of [issue #618](https://github.com/heidrun-org/heidrun/issues/618) records each public operation of this package: see [request_log](../../auxiliary/request_log/CONTEXT.md).
