# data_layer_chat_sessions

A Rust library and a command line tool for [Heidrun](../../../README.md). Both read the chat sessions that Claude Code and Codex saved for a repository, and write the facts of each one in a SQLite file. It is the Past chats source of the data layer of Heidrun. The data layer as a whole is [issue 452](https://github.com/heidrun-org/heidrun/issues/452), and this package comes from [issue 463](https://github.com/heidrun-org/heidrun/issues/463). The name `data_layer_chat_sessions` is the name of the package and the name of the executable. A chat session is what the rest of Heidrun calls a chat.

## What it contains

- `src/lib.rs`: the public interface of the library.
- `src/main.rs` and `src/command_line.rs`: the command line. It is the executable `data_layer_chat_sessions`.
- `src/coding_agents/`: the reading of the chat session files of Claude Code and of Codex. The desktop application uses this folder to list its Past chats sidebar section.
- `src/storage/`: the SQLite file. The file `database.rs` holds the file and its five tables. The file `query_formatter.rs` writes the rows of a query as a text table or as JSON.
- `src/model/`: the facts. The file `types.rs` holds the data shapes. The file `schemas.rs` checks a chat session against its JSON schema.
- `src/repository_finder.rs`: finds the root and the repository `owner/name` of a folder. It is the only code that runs the command `git`.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the file `chat_session.schema.json`. It is the only place that says which facts the column `data` stores.
- `tests/`: the tests of the executable, with fake folders of the two coding agents. The tests of the library sit at the end of each source file.

## Command line

Run the command from the root of the repository, with the npm script `data_layer:chat_sessions`. The option `--silent` of `pnpm` removes the lines that `pnpm` prints before the answer, which a program that reads the answer needs. The first run builds the executable, which takes some time. It has three commands: `initialize` and `update` fill the database, and `query` reads it. The commands `initialize` and `update` need no network and no account: they read the files of the two coding agents on this computer.

```sh
pnpm --silent data_layer:chat_sessions initialize                     # read everything since the beginning
pnpm --silent data_layer:chat_sessions update                         # read only what changed since the last read
pnpm --silent data_layer:chat_sessions update --verbose               # the same, and print the progress
pnpm --silent data_layer:chat_sessions initialize --database /path/to/a.sqlite --folder /path/to/repository
pnpm --silent data_layer:chat_sessions query "SELECT count(*) AS count FROM chat_sessions"
```

The command runs in the folder of the package, so give a database file and a folder with absolute paths.

| Option | Commands | Effect |
| --- | --- | --- |
| `--database <path>` | all three | The SQLite file. The default is `~/.config/heidrun/data_layer.sqlite`, the same file as `data_layer_code_hosting`. The commands `initialize` and `update` create the file and its folder when they do not exist. The command `query` needs the file to exist. |
| `--folder <path>` | `initialize`, `update` | A folder of the repository. The command walks up to the first folder that holds `.git`. The default is the current folder. |
| `--repository <owner/name>` | `initialize`, `update` | The name of the repository, for the column `repository`. The default is the address of the remote `origin` of the repository. |
| `--verbose` | `initialize`, `update` | Prints the progress on the standard error output. The report stays on the standard output. |
| `--json` | `query` | Prints the rows as a JSON list, and not as a text table. |
| `--help` | all three | Shows the description and the options. |

The chat session files are in `~/.claude/projects` for Claude Code (the variable `CLAUDE_CONFIG_DIR` changes the folder `~/.claude`) and in `~/.codex/sessions` for Codex (the variable `CODEX_HOME` changes the folder `~/.codex`). The command reads the chat sessions of the root of the repository only, and not the chat sessions of its worktrees. It reads the files that Codex compressed with zstd (`rollout-….jsonl.zst`) like the other files of Codex, and the tokens of each chat session of Claude Code include the tokens of its subagents and of its workflows. The library can also find the chat sessions of the folders below a folder (`FolderScope::WithFoldersBelow`), as the AI cost of the Statistics window needs.

How the two modes work:

- `initialize` reads every chat session file of the repository, and writes all the rows.
- `update` reads again the chat session files that changed at the date of the last read or later, and adds or changes only these rows.
- The date of the last read is the largest value of the column `updatedAt` of the table `chat_sessions`, for the repository. The package keeps no other state. When the table has no row for the repository, `update` reads everything, as `initialize` does.
- Each mode can run again and again. A row that is already in the table is replaced, with its link rows, and no row is written two times.
- The command prints a report of two lines on the standard output. It exits with code 1 and prints an error message on the standard error output when it fails.

## The database

The SQLite file has five tables. The table `chat_sessions` has one row for each chat session, with these four columns, and no other column:

| Column | Content |
| --- | --- |
| `repository` | The repository, in the format `owner/name`. |
| `id` | The name of the chat session file of Claude Code, or the identifier of the chat session of Codex. |
| `updatedAt` | The date of the last change of the chat session file, in the format ISO 8601. |
| `data` | The JSON text of the facts of the chat session: the coding agent, the title, the date of the first and of the last record, the number of messages of the developer, and the tokens of each model. |

The primary key is `repository` and `id`. The fields of the column `data` follow the JSON schema in the folder `schemas`. Every chat session is checked against its JSON schema before it is written, and a wrong chat session writes nothing. The package stores facts only: no message text, and no cost, because the cost depends on a price list that changes.

The four link tables hold what each chat session is linked to, one row for each value. Each one has the columns `repository`, `chatSessionId`, and one column for the value:

| Table | Value column | Content |
| --- | --- | --- |
| `chat_session_folders` | `folder` | The folders where the coding agent ran. |
| `chat_session_issues` | `issueNumber` | The numbers of the issues that the chat session mentions. |
| `chat_session_pull_requests` | `pullRequestNumber` | The numbers of the pull requests that the chat session mentions. |
| `chat_session_files` | `path` | The files that the coding agent wrote. |

The columns `repository` and `issueNumber` of `chat_session_issues` join the columns `repository` and `number` of the table `issues` of `data_layer_code_hosting`, in the same SQLite file. The columns of `chat_session_pull_requests` join the table `pull_requests` the same way.

## Query

The command `query` runs one SQL statement and prints the rows. It opens the database read only, so a statement that writes fails, and the file never changes. The column `data` holds JSON, so use the JSON functions of SQLite, for example `json_extract(data, '$.title')`. With `--json`, the output is a JSON list with one object for each row.

Each query below works on the real database.

The chat sessions and the messages of the developer for each coding agent:

```sh
pnpm --silent data_layer:chat_sessions query "SELECT json_extract(data, '$.codingAgent') AS coding_agent, count(*) AS chat_sessions, sum(json_extract(data, '$.userMessageCount')) AS messages
FROM chat_sessions
GROUP BY coding_agent"
```

The five issues that the most chat sessions mention:

```sh
pnpm --silent data_layer:chat_sessions query "SELECT issueNumber AS issue, count(*) AS chat_sessions
FROM chat_session_issues
GROUP BY issueNumber
ORDER BY chat_sessions DESC, issue DESC
LIMIT 5"
```

The output tokens of each model:

```sh
pnpm --silent data_layer:chat_sessions query "SELECT json_extract(tokens.value, '$.model') AS model, sum(json_extract(tokens.value, '$.output')) AS output_tokens
FROM chat_sessions, json_each(json_extract(chat_sessions.data, '$.tokens')) AS tokens
GROUP BY model
ORDER BY output_tokens DESC"
```

## Tests

```sh
pnpm --filter data_layer_chat_sessions test
```

The command runs `cargo test`. The tests of the executable use fake folders of the two coding agents, given by the variables `CLAUDE_CONFIG_DIR` and `CODEX_HOME`, and a real Git repository with a fake remote `origin`, so they need no network and no account.
