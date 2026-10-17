# data_layer_coding_agents

A Rust library and a command line tool for [Heidrun](../../../README.md). Both read the chat sessions that Claude Code and Codex saved for a repository, and the coding agent configuration (the memory files, the subagents, and the skills), and write the facts of each one in a SQLite file. They also store the tokens that each chat session used in each minute, and the prices of the models, so that the estimated cost in US dollars of any period is one SQL query away. It is the coding agents source of the data layer of Heidrun. The package was named `data_layer_chat_sessions` until [issue 569](https://github.com/heidrun-org/heidrun/issues/569) added the coding agent configuration. The data layer as a whole is [issue 452](https://github.com/heidrun-org/heidrun/issues/452), and this package comes from [issue 463](https://github.com/heidrun-org/heidrun/issues/463). The name `data_layer_coding_agents` is the name of the package and the name of the executable. A chat session is what the rest of Heidrun calls a chat.

## What it contains

- `src/lib.rs`: the public interface of the library.
- `src/main.rs` and `src/command_line.rs`: the command line. It is the executable `data_layer_coding_agents`.
- `src/coding_agents/`: the reading of the chat session files of Claude Code and of Codex, and of the coding agent configuration. The desktop application uses this folder to list its Past chats sidebar section.
- `src/storage/`: the SQLite file. The file `database.rs` holds the five tables of the chat sessions, the file `configuration_database.rs` holds the three tables of the coding agent configuration, the file `token_usage_database.rs` holds the tokens of each minute, and the file `model_price_database.rs` holds the prices. The file `query_formatter.rs` writes the rows of a query as a text table or as JSON.
- `src/pricing/`: the public price list of the models, and the calculation of a cost.
- `src/model/`: the facts. The file `types.rs` holds the data shapes. The file `schemas.rs` checks each row against its JSON schema.
- `src/repository_finder.rs`: finds the root and the repository `owner/name` of a folder. It is the only code that runs the command `git`.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the files `chat_session.schema.json`, `memory_file.schema.json`, `subagent.schema.json`, and `skill.schema.json`. They are the only place that says which facts the column `data` stores.
- `tests/`: the tests of the executable, with fake folders of the two coding agents. The tests of the library sit at the end of each source file.

## Command line

Run the command from the root of the repository, with the npm script `data_layer:coding_agents`. The option `--silent` of `pnpm` removes the lines that `pnpm` prints before the answer, which a program that reads the answer needs. The first run builds the executable, which takes some time. It has three commands: `initialize` and `update` fill the database, and `query` reads it. The commands `initialize` and `update` need no account: they read the files of the two coding agents on this computer. They use the network for one thing only: they fetch the public price list of the models when the latest version is one day old.

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
| `--price-list <address>` | `initialize`, `update` | The web address, or the path of a file, of the price list in the format of LiteLLM. The default is the public price list of LiteLLM. |
| `--refresh-prices` | `initialize`, `update` | Fetches the price list even when the latest version was checked less than a day ago. |
| `--verbose` | `initialize`, `update` | Prints the progress on the standard error output. The report stays on the standard output. |
| `--json` | `query` | Prints the rows as a JSON list, and not as a text table. |
| `--help` | all three | Shows the description and the options. |

The chat session files are in `~/.claude/projects` for Claude Code (the variable `CLAUDE_CONFIG_DIR` changes the folder `~/.claude`) and in `~/.codex/sessions` for Codex (the variable `CODEX_HOME` changes the folder `~/.codex`). The command reads the chat sessions of the root of the repository only, and not the chat sessions of its worktrees. It reads the files that Codex compressed with zstd (`rollout-….jsonl.zst`) like the other files of Codex, and the tokens of each chat session of Claude Code include the tokens of its subagents and of its workflows. The token usage reads the chat sessions that started in the root of the repository or in a folder below it (`FolderScope::WithFoldersBelow`), as the AI cost of the Statistics window needs.

How the two modes work:

- `initialize` reads every chat session file of the repository, and writes all the rows.
- `update` reads again the chat session files that changed at the date of the last read or later, and adds or changes only these rows.
- The date of the last read is the largest value of the column `updatedAt` of the table `chat_sessions`, for the repository. The package keeps no other state. When the table has no row for the repository, `update` reads everything, as `initialize` does.
- Each mode can run again and again. A row that is already in the table is replaced, with its link rows, and no row is written two times.
- Both modes read every memory file, subagent, and skill, because they are few. A row whose file is gone is not deleted: its field `removedAt` takes the date of the read.
- Both modes read the token usage after the configuration. `initialize` reads every chat session file again. `update` reads the chat sessions whose files changed at the date of the last read or later, and writes only the minutes whose tokens changed. A chat session that the coding agent deleted keeps its rows.
- Both modes fetch the price list when the latest version is one day old, or with `--refresh-prices`. A price list that cannot be fetched is a warning on the standard error output, and the latest known prices stay in use.
- The command prints a report of five lines on the standard output. It exits with code 1 and prints an error message on the standard error output when it fails.

## The database

The SQLite file has twelve tables and two views. The eight tables below hold the chat sessions and the configuration. The section "The token usage and the prices" describes the other four tables and the two views. The table `chat_sessions` has one row for each chat session, with these four columns, and no other column:

| Column | Content |
| --- | --- |
| `repository` | The repository, in the format `owner/name`. |
| `id` | The name of the chat session file of Claude Code, or the identifier of the chat session of Codex. |
| `updatedAt` | The date of the last change of the chat session file, in the format ISO 8601. |
| `data` | The JSON text of the facts of the chat session: the coding agent, the title, the date of the first and of the last record, the number of messages of the developer, and the tokens of each model. |

The primary key is `repository` and `id`. The fields of the column `data` follow the JSON schema in the folder `schemas`. Every chat session is checked against its JSON schema before it is written, and a wrong chat session writes nothing. The package stores facts only: no message text, and no cost in a row, because the cost depends on a price list that changes. The view `token_usage_with_cost` calculates the cost.

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

### The token usage and the prices

| Table or view | Content |
| --- | --- |
| `token_usage_minutes` | One row for each repository, chat session, model, and minute in UTC where tokens were used: `minuteAt` (the start of the minute, for example `2026-10-11T10:00:00.000Z`), `codingAgent`, `folder` (where the chat session started), and the four token categories `freshInputTokens`, `cachedInputTokens`, `cacheWriteInputTokens`, and `outputTokens`. |
| `token_usage_synchronizations` | One row for each repository and workspace folder: `synchronizedAt` (how fresh the rows are), `readUpTo`, and the `mode`. |
| `model_price_versions` | One row for each version of the price list: `retrievedAt`, `checkedAt`, `source`, `unit`, and `contentHash`. |
| `model_prices` | The prices of each model in each version, in US dollars for one million tokens, for the four token categories. |
| `latest_model_prices` (view) | The prices of the latest version. |
| `token_usage_with_cost` (view) | The rows of `token_usage_minutes` with `priceVersion`, `priceModel`, and `costUsd`. `costUsd` is null when the model has no known price, and never zero. |

The rules of the minutes, of the workspaces, of the prices, and of the time zones are in [token_usage_and_cost.md](../../../docs/statistics/token_usage_and_cost.md).

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

The estimated cost in US dollars of each day in UTC, and the tokens that have no known price:

```sh
pnpm --silent data_layer:coding_agents query "SELECT substr(minuteAt, 1, 10) AS day_in_utc, round(sum(costUsd), 2) AS cost_usd, sum(costUsd IS NULL) AS rows_without_price
FROM token_usage_with_cost
WHERE minuteAt >= '2026-09-01T00:00:00.000Z' AND minuteAt < '2026-10-01T00:00:00.000Z'
GROUP BY day_in_utc
ORDER BY day_in_utc"
```

## Tests

```sh
pnpm --filter data_layer_coding_agents test
```

The command runs `cargo test`. The tests of the executable use fake folders of the two coding agents, given by the variables `CLAUDE_CONFIG_DIR` and `CODEX_HOME`, and a real Git repository with a fake remote `origin`, so they need no network and no account.
