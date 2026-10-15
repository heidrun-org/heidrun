# Directory Context: `/packages/data_layers/data_layer_chat_sessions`

## Purpose
A Rust library and a command line tool that read the chat sessions that Claude Code and Codex saved for a repository, and write the facts of each one in a SQLite file. It is the Past chats source of the data layer of Heidrun. The desktop application uses the library to find the chat session files and to read what each one holds. The name `data_layer_chat_sessions` is the name of the package and the name of the executable.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `ChatSessionsDatabase`, `synchronize`, `read_chat_sessions`, `ScanCache`, the functions that find the chat session files, `feed_claude_line`, `feed_codex_line`, `to_table`, `to_json`, `find_repository`, `find_root`, `claude_dir`, `codex_home`, `default_database_path`, and the data types.
- `src/main.rs`: the command line, and the executable `data_layer_chat_sessions`. The module `src/command_line.rs` reads its arguments.
- `src/coding_agents/`: the reading of the chat session files of the two coding agents — see its own CONTEXT.md.
- `src/storage/`: the SQLite file, and the text form of the rows of a query — see its own CONTEXT.md.
- `src/model/`: the data types, and the JSON schema check — see its own CONTEXT.md.
- `src/repository_finder.rs`: the root and the repository `owner/name` of a folder. It is the only code that runs `git`.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the file `chat_session.schema.json`. It is the only place that says which facts the column `data` stores.
- `tests/`: the tests of the executable, with fake folders of the coding agents. The tests of the library sit at the end of each source file, and `src/test_samples.rs` holds their sample data.
- Command to run this folder: `pnpm --silent data_layer:chat_sessions --help`
- Command to test this folder: `pnpm --filter data_layer_chat_sessions test`

## Rules
- The SQLite file has the table `chat_sessions` with exactly the columns `repository`, `id`, `updatedAt`, and `data`, and four link tables: `chat_session_folders`, `chat_session_issues`, `chat_session_pull_requests`, and `chat_session_files`. The facts are never split into more columns, and a relation is never copied into `data`.
- Every chat session is checked against its JSON schema before it is written, and a wrong chat session writes nothing. The program holds the schema file inside with `include_str!`.
- `initialize` reads every chat session file. `update` reads the files that changed at the date of the last read or later. The date of the last read is the largest `updatedAt` of the table for the repository. The package keeps no other state. Each mode can run again and again, and never writes a row two times.
- The package stores facts only: no message text and no cost.
- `query` only works on a database that is open read only, so a query never changes the file and never creates it.
- The folder `src/model/` imports from no other folder of `src/`. The folders `src/coding_agents/` and `src/storage/` import from `src/model/` only, and never from each other. Only `src/synchronization.rs` uses them together.
- Only `src/repository_finder.rs` runs the command `git`. Only `src/coding_agents/agent_homes.rs` reads the variables `CLAUDE_CONFIG_DIR` and `CODEX_HOME`, so the test of `desktop_tauri` that compares `.env.example` with the sources also reads this package.
- The library calls are blocking. The package imports nothing from another package of the repository, and it knows nothing about Tauri.
- The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`, so the folder that `pnpm worktree:create` clones is the only one. Cargo reads this file only when it runs inside this folder.

## Background
- The package comes from [issue #463](https://github.com/heidrun-org/heidrun/issues/463). The data layer as a whole is [issue #452](https://github.com/heidrun-org/heidrun/issues/452).
- The code that reads the chat session files moved here from `desktop_tauri`. The sort, the limit, the price of the tokens, and the Tauri commands stayed there.
- The relation "people" of issue 452 is not written: the text `@login` in a message of the developer found 27 words in 306 chat sessions of this repository, and none was a person (`@layer`, `@click`, and `@import` of the code that the developer pasted).
