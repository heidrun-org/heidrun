# data_layer_coding_agents

A Rust library and a command line tool for [Heidrun](../../../README.md). Both read the chat sessions that Claude Code and Codex saved for a repository, and the coding agent configuration (the memory files, the subagents, and the skills), and write the facts of each one in a SQLite file. It is the coding agents source of the data layer of Heidrun. The package was named `data_layer_chat_sessions` until [issue 569](https://github.com/heidrun-org/heidrun/issues/569) added the coding agent configuration. The data layer as a whole is [issue 452](https://github.com/heidrun-org/heidrun/issues/452), and this package comes from [issue 463](https://github.com/heidrun-org/heidrun/issues/463). The name `data_layer_coding_agents` is the name of the package and the name of the executable. A chat session is what the rest of Heidrun calls a chat.

## What it contains

- `src/lib.rs`: the public interface of the library.
- `src/main.rs` and `src/command_line.rs`: the command line. It is the executable `data_layer_coding_agents`.
- `src/coding_agents/`: the reading of the chat session files of Claude Code and of Codex, and of the coding agent configuration. The desktop application uses this folder to list its Past chats sidebar section.
- `src/storage/`: the SQLite file. The file `database.rs` holds the five tables of the chat sessions, and the file `configuration_database.rs` holds the three tables of the coding agent configuration. The file `query_formatter.rs` writes the rows of a query as a text table or as JSON.
- `src/model/`: the facts. The file `types.rs` holds the data shapes. The file `schemas.rs` checks each row against its JSON schema.
- `src/repository_finder.rs`: finds the root and the repository `owner/name` of a folder. It is the only code that runs the command `git`.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the files `chat_session.schema.json`, `memory_file.schema.json`, `subagent.schema.json`, and `skill.schema.json`. They are the only place that says which facts the column `data` stores.
- `tests/`: the tests of the executable, with fake folders of the two coding agents. The tests of the library sit at the end of each source file.

## Command line

Run the command from the root of the repository, with the npm script `data_layer:coding_agents`. The option `--silent` of `pnpm` removes the lines that `pnpm` prints before the answer, which a program that reads the answer needs. The first run builds the executable, which takes some time. It has three commands: `initialize` and `update` fill the database, and `query` reads it. The commands `initialize` and `update` need no network and no account: they read the files of the two coding agents on this computer.

```sh
pnpm --silent data_layer:coding_agents initialize                     # read everything since the beginning
pnpm --silent data_layer:coding_agents update                         # read only what changed since the last read
pnpm --silent data_layer:coding_agents update --verbose               # the same, and print the progress
pnpm --silent data_layer:coding_agents initialize --database /path/to/a.sqlite --folder /path/to/repository
pnpm --silent data_layer:coding_agents query "SELECT count(*) AS count FROM chat_sessions"
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
- Both modes read every memory file, subagent, and skill, because they are few. A row whose file is gone is not deleted: its field `removedAt` takes the date of the read.
- The command prints a report of three lines on the standard output. It exits with code 1 and prints an error message on the standard error output when it fails.

## The database

The SQLite file has eight tables. The table `chat_sessions` has one row for each chat session, with these four columns, and no other column:

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

### The coding agent configuration

The three tables `memory_files`, `subagents`, and `skills` have the same four columns as `chat_sessions`. The column `id` is the absolute path of the file, or of the folder of a skill, so it joins the column `path` of `chat_session_files`: the chat sessions that wrote the file. The column `data` holds the facts of the header of the file, never its body.

| Table | Folders | Facts of the column `data` |
| --- | --- | --- |
| `memory_files` | `~/.claude/projects/<project folder of the main checkout>/memory/*.md`, also from a worktree | The name, the description, the type (`user`, `feedback`, `project`, or `reference`), and `originChatSessionId`, the chat session that wrote it. |
| `subagents` | `.claude/agents/*.md` of the repository and of `~/.claude` | The name and the description. |
| `skills` | The folders with a `SKILL.md` in `.claude/skills` and `.agents/skills` of the repository, `~/.claude/skills`, `~/.codex/skills`, and `~/.agents/skills` | The name and the description. |

Every row also has the coding agent (`CLAUDE_CODE`, `CODEX`, or `null` for a folder `.agents`), the scope (`PROJECT` or `USER`), the folder, and the dates `createdAt`, `updatedAt`, and `removedAt`. The words are in the [glossary](../../../docs/agents_rules/glossary/coding_agent_configuration.md).

## Query

The command `query` runs one SQL statement and prints the rows. It opens the database read only, so a statement that writes fails, and the file never changes. The column `data` holds JSON, so use the JSON functions of SQLite, for example `json_extract(data, '$.title')`. With `--json`, the output is a JSON list with one object for each row.

Each query below works on the real database.

The chat sessions and the messages of the developer for each coding agent:

```sh
pnpm --silent data_layer:coding_agents query "SELECT json_extract(data, '$.codingAgent') AS coding_agent, count(*) AS chat_sessions, sum(json_extract(data, '$.userMessageCount')) AS messages
FROM chat_sessions
GROUP BY coding_agent"
```

The five issues that the most chat sessions mention:

```sh
pnpm --silent data_layer:coding_agents query "SELECT issueNumber AS issue, count(*) AS chat_sessions
FROM chat_session_issues
GROUP BY issueNumber
ORDER BY chat_sessions DESC, issue DESC
LIMIT 5"
```

The output tokens of each model:

```sh
pnpm --silent data_layer:coding_agents query "SELECT json_extract(tokens.value, '$.model') AS model, sum(json_extract(tokens.value, '$.output')) AS output_tokens
FROM chat_sessions, json_each(json_extract(chat_sessions.data, '$.tokens')) AS tokens
GROUP BY model
ORDER BY output_tokens DESC"
```

## Tests

```sh
pnpm --filter data_layer_coding_agents test
```

The command runs `cargo test`. The tests of the executable use fake folders of the two coding agents, given by the variables `CLAUDE_CONFIG_DIR` and `CODEX_HOME`, and a real Git repository with a fake remote `origin`, so they need no network and no account.
