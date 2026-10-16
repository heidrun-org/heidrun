# Directory Context: `/packages/data_layers/data_layer_coding_agents`

## Purpose
A Rust library and a command line tool that read the chat sessions that Claude Code and Codex saved for a repository, and the coding agent configuration (the memory files, the subagents, and the skills), and write the facts of each one in a SQLite file. It is the coding agents source of the data layer of Heidrun. The desktop application uses the library to find the chat session files and to read what each one holds.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library: the reading of the chat session files and of the coding agent configuration, the two databases `ChatSessionsDatabase` and `ConfigurationDatabase`, `synchronize` and `synchronize_configuration`, the texts of the JSON schemas, and the data types. Its `pub use` lines are the list.
- `src/main.rs` and `src/command_line.rs`: the executable `data_layer_coding_agents`.
- `src/coding_agents/`: the reading of the chat session files of the two coding agents, and of the coding agent configuration — see its own CONTEXT.md.
- `src/storage/`: the SQLite file, and the text form of the rows of a query — see its own CONTEXT.md.
- `src/model/`: the data types, and the JSON schema check — see its own CONTEXT.md.
- `src/repository_finder.rs`: the root and the repository `owner/name` of a folder.
- `src/synchronization.rs`: the two modes, `initialize` and `update`, and the write of the coding agent configuration.
- `schemas/`: one JSON schema file for each table that has a column `data`, the only place that says which facts the column `data` stores.
- `tests/`: the tests of the executable. The tests of the library sit at the end of each source file, with the sample data of `src/test_samples.rs`.
- Command to run this folder: `pnpm --silent data_layer:coding_agents --help`
- Command to test this folder: `pnpm --filter data_layer_coding_agents test`

## Rules
- The SQLite file has the table `chat_sessions` with exactly the columns `repository`, `id`, `updatedAt`, and `data`, and four link tables: `chat_session_folders`, `chat_session_issues`, `chat_session_pull_requests`, and `chat_session_files`. The facts are never split into more columns, and a relation is never copied into `data`.
- The tables `memory_files`, `subagents`, and `skills` have the same four columns as `chat_sessions`. The `id` is an absolute path, so it joins the column `path` of `chat_session_files`. A row whose file is gone stays, with the date in `removedAt`. The field `originChatSessionId` of a memory file is a fact of its header, not a computed link.
- Every row is checked against its JSON schema before it is written, and a wrong row writes nothing. The program holds the schema files inside with `include_str!`.
- `initialize` reads every chat session file. `update` reads the files that changed at the date of the last read or later. Both modes read the whole coding agent configuration, which is small. The date of the last read is the largest `updatedAt` of `chat_sessions` for the repository, and the package keeps no other state. Each mode can run again and again, and never writes a row two times.
- The package stores facts only: no message text, no cost, and no body of a memory file, a subagent, or a skill. It never writes in the folders of the coding agents.
- `query` only works on a database that is open read only, so a query never changes the file and never creates it.
- The folder `src/model/` imports from no other folder of `src/`. The folders `src/coding_agents/` and `src/storage/` import from `src/model/` only, and never from each other. Only `src/synchronization.rs` uses them together.
- Only `src/repository_finder.rs` runs the command `git`. Only `src/coding_agents/agent_homes.rs` reads the variables `CLAUDE_CONFIG_DIR` and `CODEX_HOME`, and the home folder for `~/.agents`, which the test of `.env.example` of `desktop_tauri` reads.
- The library calls are blocking. The package imports no other package of the repository, and knows nothing about Tauri.
- The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`, the one folder that `pnpm worktree:create` clones.

## Background
- The package comes from [issue #463](https://github.com/heidrun-org/heidrun/issues/463). It was named `data_layer_chat_sessions` until the coding agent configuration came in [issue #569](https://github.com/heidrun-org/heidrun/issues/569). The data layer as a whole is [issue #452](https://github.com/heidrun-org/heidrun/issues/452).
- The relation "people" of issue 452 is not written, because no text of a chat session names a person ([issue #463](https://github.com/heidrun-org/heidrun/issues/463)).
