# heidrun_data

A Rust library and one command line tool for [Heidrun](../../../README.md). It gives a coding agent (Claude Code, Codex, or Antigravity) the data of the [four data layers](../../../docs/statistics/the_four_data_layers.md) of Heidrun with one command, in place of four. It is not a data layer: it calls the libraries of [data_layer_source_control](../data_layer_source_control/README.md), [data_layer_code_hosting](../data_layer_code_hosting/README.md), [data_layer_coding_agents](../data_layer_coding_agents/README.md), and [data_layer_user_activity](../data_layer_user_activity/README.md), and adds no table to the SQLite file. The package comes from the plan of [issue 564](https://github.com/heidrun-org/heidrun/issues/564).

## What it contains

- `src/lib.rs`: the public interface of the library.
- `src/main.rs` and `src/command_line.rs`: the command line, and the texts of its help.
- `src/sources.rs`: the four sources, their tables, and their fixed order.
- `src/synchronization.rs`: the modes `initialize` and `update` of each source, with the library of its data layer.
- `src/database.rs`: the SQLite file, open read only, for `query` and `sources`.
- `src/schema.rs`: the shape of the tables and of the views, for the command `schema`.
- `src/usage.rs`: the command `usage`: the tokens and the estimated cost of a workspace in a time range, by minute, hour, or day, read from the SQLite file only.
- `src/database_lock.rs`: the one lock of the SQLite file, which the desktop application takes too.
- `src/reading/`: the command `read`: a chat session, a commit, an issue, or a pull request.
- `skills/heidrun_data/`: the skill for a coding agent, [SKILL.md](skills/heidrun_data/SKILL.md), with its folder `references`. The files of `references` are links to their place in the folder `docs` of the repository, so copy the skill with `cp -RL skills/heidrun_data <destination>` to install it outside the repository: the option `-L` copies the files in place of the links.
- `src/query_limit.rs`: the `LIMIT` added to a query that has none.
- `src/output.rs`: the three output formats, and the errors.
- `tests/`: the tests of the executable.

## Command line

Run the command from the root of the repository, with the npm script `data_layer:heidrun_data`. The option `--silent` of `pnpm` removes the lines that `pnpm` prints before the answer. The command runs in the folder of the package, which is inside the repository of Heidrun, so the sources read the repository of Heidrun when the option `--folder` is not given.

```sh
pnpm --silent data_layer:heidrun_data sources --format jsonl
pnpm --silent data_layer:heidrun_data update --format jsonl
pnpm --silent data_layer:heidrun_data update coding_agents code_hosting --format jsonl
pnpm --silent data_layer:heidrun_data query --format jsonl "SELECT json_extract(data, '$.subject') AS subject FROM commits ORDER BY committedAt DESC LIMIT 5"
pnpm --silent data_layer:heidrun_data --help
```

| Command | Effect |
| --- | --- |
| `sources` | One row per source: its tables, the number of rows of each table, and the date of the last update. |
| `update [<source>...]` | Reads what is new in every source, or in the sources given. |
| `initialize [<source>...]` | Reads every source since the beginning, or the sources given. |
| `schema [<table>]` | Prints every table with its columns, its primary key, and its joins. With a table, prints the JSON schema of its column `data`. `--format sql` prints the `CREATE TABLE` statements. |
| `usage` | Prints the tokens and the estimated cost in US dollars of a workspace in a time range, one row for each minute, hour, or day. It reads the SQLite file only, never a chat session file. `--by` gives the period, `--since` and `--until` the range, `--time-zone` the zone that cuts the days, and `--by-chat` one row for each chat session. |
| `read <kind> <key>` | Prints the content of a `chat_session`, a `commit`, an `issue`, or a `pull_request` from its source. `--full` prints the tool calls whole, and `--no-diff` prints no diff. |
| `query <sql>` | Runs one read-only SQL statement. `-` reads the statement from the standard input. `--limit <count>` sets the limit added to a statement that has none (default 1000, and 0 adds none). |

| Option | Commands | Effect |
| --- | --- | --- |
| `--database <path>` | all | The SQLite file. The default is `~/.config/heidrun/data_layer.sqlite`. |
| `--format <name>` | all | `jsonl`, `json`, or `table`. The default is `table` at a terminal and `jsonl` in a pipe. `--json` is the same as `--format json`. |
| `--verbose` | all | Prints the progress on the standard error output. |
| `--repository <owner/name>` | `update`, `initialize` | The name of the repository, for `source_control`, `code_hosting`, and `coding_agents`. |
| `--folder <path>` | `update`, `initialize` | The folder of the Git repository, for the same three sources. |
| `--file <path>` | `update`, `initialize` | The file of the user activity records, for `user_activity`. |
| `--price-list <address>` | `update`, `initialize` | The web address, or the path of a file, of the price list of the models, for `coding_agents`. The default is the public price list of LiteLLM. |
| `--refresh-prices` | `update`, `initialize` | Fetches the price list even when the latest version was checked less than a day ago. |

The prices are fetched when the latest version is one day old. A price list that cannot be fetched is a warning on the standard error output, and not an error: the latest known prices stay in use, and the exit code stays 0. The rules of the token usage and of the cost are in [token_usage_and_cost.md](../../../docs/statistics/token_usage_and_cost.md).

A source that fails does not stop the others: the command prints one error for each, and exits with the code 1. `update` and `initialize` take the lock of the SQLite file, so they wait for the desktop application. The lock is `lock_database`, and it uses the file `data_layer.sqlite.lock` next to the SQLite file. The `read` of an issue or of a pull request needs the command `gh`, and GitLab is not supported yet, as in `data_layer_code_hosting`.

## The request log

Every public operation of the four data layers and of `heidrun_data` is recorded in the request log: one line when the request starts and one line when it ends. The command `requests` reads the log. The description, the format, and the measures are in [data_layer_request_log.md](../../../docs/statistics/data_layer_request_log.md).

| Action | What it does |
| --- | --- |
| `requests info` | Prints the log file, its size, the version of its format, and the counts of requests, failures, unfinished requests, and damaged lines. |
| `requests summary` | Prints the usage patterns: the count, the failures, and the total, mean, median, 90th, 95th, and 99th percentile, and longest time of each group of requests. `--by operation`, `--by pattern`, and `--by parameters` choose the group, and `--repeated` keeps the requests that were asked twice or more. |
| `requests list` | Prints the requests one by one, with their parameters: the export of the log. |
| `requests replay` | Runs recorded requests again through the data layer, and prints the original time next to the replay time. A query or a `find_*` call of the desktop application reads a snapshot. A synchronization or a `refresh_*` call writes a new file that `--isolated-database` names. |
| `requests snapshot --to <path>` | Copies the SQLite file in a consistent file. |
| `requests overhead` | Measures what the log costs a request, in time and in bytes. |

## Tests

`pnpm --filter heidrun_data test` runs the tests, with a real Git repository in a temporary folder, a fake `gh` command, fake folders of Claude Code and of Codex, and a fake file of user activity records.
