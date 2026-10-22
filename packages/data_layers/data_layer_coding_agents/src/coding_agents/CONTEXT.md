# Directory Context: `/packages/data_layers/data_layer_coding_agents/src/coding_agents`

## Purpose
Finds the chat session files of Claude Code and of Codex for one folder, reads what each file holds without a model, and turns it into the stored shape. Reads the coding agent configuration of a repository: the memory files, the subagents, and the skills.

## Key Exports & Entry Points
- `scan.rs`: `Scan`, `ChatMeta`, `feed_claude_line`, `feed_codex_line`, `feed_claude_tokens_line`, and `scan_file`: the title, the dates, the messages, the folders, the issues, the pull requests, and the files that the coding agent wrote. A file that ends with `.zst` is decompressed while it is read (`open_lines`).
- `tokens.rs`: `TokenScan`, `TokenCounts`, `TokensByModel`, and `TokensByMinute`: the tokens of each model, and of each minute in UTC. A request without a readable date is in `UNDATED_MINUTE`.
- `token_usage_reader.rs`: `read_token_usage`, `TokenUsageFiles`, and `minutes_of`, which give the tokens of each minute of each chat session of a workspace, with the folders below it.
- `scan_cache.rs`: `ScanCache`, which keeps the scan of each file until its size or its date changes, and continues the scan of a file that only grew. `scan_claude` adds the tokens of the subagents and of the workflows of a chat to the chat.
- `session_files.rs`: `find_claude_session_files`, `find_codex_session_files`, `find_claude_agent_files`, `FolderScope`, `read_codex_titles`, and `title_of_scan`. `FolderScope` says whether the folders below the folder of the workspace count.
- `session_reader.rs`: `read_chat_sessions`, which gives the `ChatSessionRecord` of each file.
- `configuration_reader.rs`: `read_configuration`, `ConfigurationFolders`, and `read_header`, the fields of the header of a file between its two lines `---`.
- `agent_homes.rs`: `claude_dir`, `codex_home`, and `agents_home`.
- Command to test this folder: `pnpm --filter data_layer_coding_agents test`

## Rules
- Nothing here imports from `src/storage/` or from `src/pricing/`.
- The code never runs a model, never runs `git`, and never writes in the folders of the coding agents.
- A scan stops at the end of the last complete line, so that the next scan of the same file continues from there. For a compressed file the byte is a position in the decompressed text.
- The files of the subagents and of the workflows of a chat of Claude Code (`<chat id>/subagents/**/*.jsonl`) give tokens only: their user lines are prompts of the main agent, not messages of the developer.
- A folder of Claude Code that starts with the name of the folder of the workspace is a chat folder below it only when its first `cwd` is the folder of the workspace or a folder below it, so `<folder>-site` is never one.
- A review chat of Codex (`ChatMeta::is_review_chat`, the source `{"subagent":{"other":"guardian"}}` of its record `session_meta`) is never a chat session ([issue 557](https://github.com/heidrun-org/heidrun/issues/557)).
- A chat of Codex that exists as `.jsonl` and as `.jsonl.zst` is listed once, with the file that is not compressed.
- The Past chats list and the chat sessions of the SQLite file use `FolderScope::Exactly`; the token usage uses `FolderScope::WithFoldersBelow` ([issue 558](https://github.com/heidrun-org/heidrun/issues/558)).
- A review chat of Codex has no token usage row, as in the Past chats list. A chat with no token gives an empty list of minutes, so `read_token_usage` can delete its old rows.
- Two files with the same chat session identifier (Claude Code copies a resumed chat into another project folder) give one token usage: the file that changed last. The rule keeps a read of everything and a read of the changed files equal ([issue 616](https://github.com/heidrun-org/heidrun/issues/616)).
- A change in what `ChatMeta` or `TokenScan` holds needs a new `CACHE_VERSION` in `scan_cache.rs`, so that the desktop application reads the old files again.
- The tests give fake folders of the coding agents, so they need no real chat session.
