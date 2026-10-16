# heidrun_data

A Rust library and one command line tool for [Heidrun](../../../README.md). It gives a coding agent (Claude Code, Codex, or Antigravity) the data of the [four data layers](../../../docs/statistics/the_four_data_layers.md) of Heidrun with one command, in place of four. It is not a data layer: it calls the libraries of [data_layer_source_control](../data_layer_source_control/README.md), [data_layer_code_hosting](../data_layer_code_hosting/README.md), [data_layer_chat_sessions](../data_layer_chat_sessions/README.md), and [data_layer_user_activity](../data_layer_user_activity/README.md), and adds no table to the SQLite file. The package comes from the step 1 of the plan of [issue 564](https://github.com/heidrun-org/heidrun/issues/564).

## What it contains

- `src/lib.rs`: the public interface of the library.
- `src/main.rs` and `src/command_line.rs`: the command line, and the texts of its help.
- `src/sources.rs`: the four sources, their tables, and their fixed order.
- `src/synchronization.rs`: the modes `initialize` and `update` of each source, with the library of its data layer.
- `src/database.rs`: the SQLite file, open read only, for `query` and `sources`.
- `src/query_limit.rs`: the `LIMIT` added to a query that has none.
- `src/output.rs`: the three output formats, and the errors.
- `tests/`: the tests of the executable.

## Command line

Run the command from the root of the repository, with the npm script `data_layer`. The option `--silent` of `pnpm` removes the lines that `pnpm` prints before the answer. The command runs in the folder of the package, which is inside the repository of Heidrun, so the sources read the repository of Heidrun when the option `--folder` is not given.

```sh
pnpm --silent data_layer sources --format jsonl
pnpm --silent data_layer update --format jsonl
pnpm --silent data_layer update chat_sessions code_hosting --format jsonl
pnpm --silent data_layer query --format jsonl "SELECT json_extract(data, '$.subject') AS subject FROM commits ORDER BY committedAt DESC LIMIT 5"
pnpm --silent data_layer --help
```

| Command | Effect |
| --- | --- |
| `sources` | One row per source: its tables, the number of rows of each table, and the date of the last update. |
| `update [<source>...]` | Reads what is new in every source, or in the sources given. |
| `initialize [<source>...]` | Reads every source since the beginning, or the sources given. |
| `query <sql>` | Runs one read-only SQL statement. `-` reads the statement from the standard input. `--limit <count>` sets the limit added to a statement that has none (default 1000, and 0 adds none). |

| Option | Commands | Effect |
| --- | --- | --- |
| `--database <path>` | all | The SQLite file. The default is `~/.config/heidrun/data_layer.sqlite`. |
| `--format <name>` | all | `jsonl`, `json`, or `table`. The default is `table` at a terminal and `jsonl` in a pipe. `--json` is the same as `--format json`. |
| `--verbose` | all | Prints the progress on the standard error output. |
| `--repository <owner/name>` | `update`, `initialize` | The name of the repository, for `source_control`, `code_hosting`, and `chat_sessions`. |
| `--folder <path>` | `update`, `initialize` | The folder of the Git repository, for the same three sources. |
| `--file <path>` | `update`, `initialize` | The file of the user activity records, for `user_activity`. |

A source that fails does not stop the others: the command prints one error for each, and exits with the code 1. The command `heidrun_data update` does not take the lock of the desktop application yet, so a write of the desktop application at the same time can fail with the error "database is locked". A later step of issue 564 moves the lock into this package.

## Tests

`pnpm --filter heidrun_data test` runs the tests, with a real Git repository in a temporary folder, a fake `gh` command, fake folders of Claude Code and of Codex, and a fake file of user activity records.
