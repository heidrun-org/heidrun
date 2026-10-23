# Directory Context: `/packages/data_layers/heidrun_code_data/src/reading`

## Purpose
The command `read`: the content of one chat session, one commit, one issue, or one pull request, and the history of one file in the chat sessions, read from its source each time. The tables of the SQLite file store facts only, so this content is never stored.

## Key Exports & Entry Points
- `chat_session_reader.rs`: `read_chat_session`, `ChatRecord`, and `Role`. The records of a chat session file of Claude Code or of Codex, compressed or not.
- `file_history_reader.rs`: `read_file_history` and `FileChange`. Every tool call of a chat session that wrote one file, with its input whole, because the tables keep only the last state of a memory file, a subagent, or a skill ([issue #569](https://github.com/heidrun-org/heidrun/issues/569)).
- `commit_reader.rs`: `read_commit` and `CommitContent`. The message, the files, and the diff of a commit.
- `code_hosting_reader.rs`: `read_code_hosting`, `read_pull_request_diff`, `Entry`, and `CodeHostingKind`. The body, the comments, the reviews, and the diff of an issue or of a pull request.

## Rules
- Nothing here opens the SQLite file, and nothing here writes a file.
- The chat session files are found with the library of `data_layer_coding_agents`, with the scope of the folder and of the folders below it, so a chat session of a worktree is found too.
- `git` runs only through the `GitRunner` of `data_layer_source_control`, and the GraphQL queries only through the `GraphqlRunner` of `data_layer_code_hosting`. The diff of a pull request is the only call of `gh` here, with `gh pr diff`.
- GitHub only, as `data_layer_code_hosting`: the support of GitLab comes at the same time as in that package.

## Background
- The command is the step 3 of [issue #564](https://github.com/heidrun-org/heidrun/issues/564).
