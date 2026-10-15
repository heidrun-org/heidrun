# Directory Context: `/packages/data_layers/data_layer_chat_sessions/src/coding_agents`

## Purpose
Finds the chat session files of Claude Code and of Codex for one folder, reads what each file holds without a model, and turns it into the stored shape.

## Key Exports & Entry Points
- `scan.rs`: `Scan`, `ChatMeta`, `feed_claude_line`, `feed_codex_line`, and `scan_file`: the title, the dates, the messages, the folders, the issues, the pull requests, and the files that the coding agent wrote.
- `tokens.rs`: `TokenScan`, `TokenCounts`, `TokensByModel`, `TokensByHour`, and `UNDATED_HOUR`: the tokens of each model, and of each hour in UTC. A request without a readable date is in `UNDATED_HOUR`.
- `scan_cache.rs`: `ScanCache`, which keeps the scan of each file until its size or its date changes, and continues the scan of a file that only grew.
- `session_files.rs`: `find_claude_session_files`, `find_codex_session_files`, `read_codex_titles`, and `title_of_scan`.
- `session_reader.rs`: `read_chat_sessions`, which gives the `ChatSessionRecord` of each file.
- `agent_homes.rs`: `claude_dir` and `codex_home`.
- Command to test this folder: `pnpm --filter data_layer_chat_sessions test`

## Rules
- Nothing here imports from `src/storage/`. Only `session_reader.rs` imports from `src/model/`.
- The code never runs a model, never runs `git`, and never writes in the folders of the coding agents.
- A scan stops at the end of the last complete line, so that the next scan of the same file continues from there.
- A change in what `ChatMeta` or `TokenScan` holds needs a new `CACHE_VERSION` in `scan_cache.rs`, so that the desktop application reads the old files again.
- The tests give fake folders of the coding agents, so they need no real chat session.
