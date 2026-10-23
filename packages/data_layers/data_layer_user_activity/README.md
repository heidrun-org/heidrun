# data_layer_user_activity

A Rust library and a command line tool for [Heidrun](../../../README.md). Both read the user activity records of the developer from the file `user_activity.jsonl`, and write each one in the table `user_activity_records` of a SQLite file. It is the User activity source of the data layer of Heidrun. The data layer as a whole is [issue 452](https://github.com/heidrun-org/heidrun/issues/452), and this package comes from [issue 474](https://github.com/heidrun-org/heidrun/issues/474). The name `data_layer_user_activity` is the name of the package and the name of the executable. The package has the same structure as [data_layer_source_control](../data_layer_source_control/README.md), and the packages write in the same SQLite file.

A user activity record describes one active period of the developer in front of Heidrun, in one workspace. The web frontend writes each record as one line of the file when the active period ends. The rules of the records are in [the rules of the User activity sidebar section](../../../docs/agents_rules/user_interface/sidebars/user_activity.md). The web frontend removes the lines that are older than 400 days from the file, so the SQLite file is the place that keeps every record for ever.

## What it contains

- `src/lib.rs`: the public interface of the library.
- `src/main.rs` and `src/command_line.rs`: the command line. It is the executable `data_layer_user_activity`.
- `src/user_activity_file/`: the reading of the file. The file `user_activity_file_reader.rs` reads the lines, skips the lines that are not valid, and gives each valid line as a record with its times in UTC.
- `src/storage/`: the SQLite file. The file `database.rs` holds the file, its table, and its index. The file `query_formatter.rs` writes the rows of a query as a text table or as JSON.
- `src/model/`: the facts. The file `types.rs` holds the data shapes. The file `schemas.rs` checks a record against its JSON schema. The file `utc_time.rs` turns a time with a time zone offset into a time in UTC.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the file `user_activity_record.schema.json`. It is the only place that says which fields the database stores.
- `tests/`: the tests of the executable, with a fake file of records in a temporary folder. The tests of the library sit at the end of each source file.

## Command line

Run the command from the root of the repository, with the npm script `data_layer:user_activity`. The option `--silent` of `pnpm` removes the lines that `pnpm` prints before the answer, which a program that reads the answer needs. The first run builds the executable, which takes some time. It has three commands: `initialize` and `update` fill the database, and `query` reads it.

```sh
pnpm --silent data_layer:user_activity initialize                   # read every line of the file
pnpm --silent data_layer:user_activity update                       # read only the records that ended after the latest end of the database
pnpm --silent data_layer:user_activity update --verbose             # the same, and print the progress
pnpm --silent data_layer:user_activity initialize --database /path/to/a.sqlite --file /path/to/user_activity.jsonl
pnpm --silent data_layer:user_activity query "SELECT count(*) AS count FROM user_activity_records"
```

The command runs in the folder of the package, so give a database file and a file of records with an absolute path.

| Option | Commands | Effect |
| --- | --- | --- |
| `--database <path>` | all three | The SQLite file. The default is `~/.config/heidrun/data_layer.sqlite`. The commands `initialize` and `update` create the file and its folder when they do not exist. The command `query` needs the file to exist. |
| `--file <path>` | `initialize`, `update` | The file of the user activity records. The default is `user_activity.jsonl` in the folder of the variable `HEIDRUN_DIR`, or else in `~/.config/heidrun`. The option replaces the whole path. |
| `--verbose` | `initialize`, `update` | Prints the progress on the standard error output: each line that is skipped, with its number and its reason, the number of records, and each write. The report stays on the standard output. |
| `--json` | `query` | Prints the rows as a JSON list, and not as a text table. |
| `--help` | all three | Shows the description and the options. |

How the two modes work:

- `initialize` reads every line of the file, and writes all the rows.
- `update` reads only the records whose `endedAt` is later than the largest `endedAt` of the table. When the table has no row, it reads everything. The web frontend appends a record when its active period ends, so the lines of the file come in the order of their end.
- Each mode can run again and again. A row that is already in the table is replaced, and no row is written two times.
- A row is never deleted. A record that the web frontend removes from the file stays in the table.
- A line that is not a JSON object that follows the JSON schema is skipped and never written. The command counts the skipped lines, and prints the count. An empty line is neither read nor counted.
- The times of the file carry the offset of the time zone of the computer, for example `+02:00`. The package converts them to UTC when it reads a line.
- The package never writes the file of the records. Only the web frontend writes it.
- A file that does not exist is not an error: the web frontend writes the file when the first active period ends. The report says that the file does not exist, and nothing is written.
- The command prints a report of three lines on the standard output: the file and the database, the number of records written and the number of records that the mode `update` had already read, and the number of skipped lines. It exits with code 1 and prints an error message on the standard error output when the file exists and cannot be read, for example when its path is a folder.
- The package does not read the active period that runs now, because the web frontend writes a record only when the active period ends. A record can also be lost when the application quits through the menu. The package cannot see these two cases.

## The database

The table `user_activity_records` has these four columns, and no other column:

| Column | Content |
| --- | --- |
| `workspaceFolder` | The folder of the workspace. |
| `startedAt` | The time of the first action of the active period, in UTC. |
| `endedAt` | The end of the active period, in UTC. |
| `data` | The JSON text of the record. |

The primary key is `workspaceFolder` and `startedAt`. An index on `endedAt` makes the query "which records overlap this time range" fast. A time is written in UTC with three digits of milliseconds and the letter `Z`, for example `2026-10-14T17:52:03.412Z`, so two times compare as text. The fields of the column `data` follow the JSON schema in the folder `schemas`:

| Field | Content |
| --- | --- |
| `workspaceFolder` | The folder of the workspace: its worktree path, or the working directory of one of its panes. |
| `startedAt` | The time of the first action. |
| `lastActionAt` | The time of the last action. |
| `endedAt` | The end of the active period: `lastActionAt` plus the cool down, or the earlier time of the event that ended the active period. |
| `keyboardActionCount`, `mouseActionCount` | The number of keyboard actions and the number of mouse actions. Numbers only: a record never holds a key that the developer typed. |
| `endReason` | The reason why the active period ended: `cool_down`, `window_behind`, `workspace_changed`, or `app_closed`. |

A record holds the folder of the workspace, and not the name of the repository, so the package writes no link table. Every record is checked against its JSON schema before it is written, and a wrong record writes nothing. The default SQLite file is the file of the other data layer packages. Each package creates and writes only its own tables in it.

## Query

The command `query` runs one SQL statement and prints the rows. It opens the database read only, so a statement that writes fails with the error "attempt to write a readonly database", and the file never changes. The column `data` holds JSON, so use the JSON functions of SQLite, for example `json_extract(data, '$.endReason')`.

```sh
pnpm --silent data_layer:user_activity query "SELECT workspaceFolder, startedAt, endedAt FROM user_activity_records ORDER BY endedAt DESC LIMIT 5"
```

The default output is a text table: a line of column names, a line of dashes, one line for each row, and the row count. A null value is written `NULL`. With `--json`, the output is a JSON list with one object for each row, for another program to read:

```sh
pnpm --silent data_layer:user_activity query --json "SELECT count(*) AS count FROM user_activity_records"
```

The command exits with code 1 and prints an error message on the standard error output when the statement is wrong, or when the database file does not exist. The command `sqlite3` of macOS also opens the file, with the same statements.

### Four example queries

Each query works on the real database. The dates are in UTC.

The number of active periods and the number of hours on each day, the newest day first:

```sh
pnpm --silent data_layer:user_activity query "SELECT substr(startedAt, 1, 10) AS day,
       count(*) AS periods,
       round(sum((julianday(endedAt) - julianday(startedAt)) * 24), 2) AS hours
FROM user_activity_records
GROUP BY day
ORDER BY day DESC
LIMIT 10"
```

The number of hours in each folder of a workspace:

```sh
pnpm --silent data_layer:user_activity query "SELECT workspaceFolder,
       count(*) AS periods,
       round(sum((julianday(endedAt) - julianday(startedAt)) * 24), 2) AS hours
FROM user_activity_records
GROUP BY workspaceFolder
ORDER BY hours DESC"
```

The number of active periods, of keyboard actions, and of mouse actions for each end reason:

```sh
pnpm --silent data_layer:user_activity query "SELECT json_extract(data, '$.endReason') AS endReason,
       count(*) AS periods,
       sum(json_extract(data, '$.keyboardActionCount')) AS keyboardActions,
       sum(json_extract(data, '$.mouseActionCount')) AS mouseActions
FROM user_activity_records
GROUP BY endReason
ORDER BY periods DESC"
```

The active periods that overlap a time range, here the hour from 22:00 to 23:00 on 14 October 2026. A record overlaps the range when it ends after the start of the range and starts before the end of the range:

```sh
pnpm --silent data_layer:user_activity query "SELECT workspaceFolder, startedAt, endedAt
FROM user_activity_records
WHERE endedAt > '2026-10-14T22:00:00.000Z' AND startedAt < '2026-10-14T23:00:00.000Z'
ORDER BY startedAt"
```

## Library

The desktop application can use the library as a path dependency, as it does for `coding_agent_cli`:

```toml
data_layer_user_activity = { path = "../../data_layers/data_layer_user_activity" }
```

```rust
use data_layer_user_activity::{
    default_database_path, default_user_activity_file_path, synchronize, SynchronizationMode, UserActivityDatabase,
    UserActivityFileReader,
};

// Fill the database.
let reader = UserActivityFileReader::new(&default_user_activity_file_path());
let mut database = UserActivityDatabase::open(&default_database_path())?;
let report = synchronize(SynchronizationMode::Update, &reader, &mut database, &|_| {})?;

// Read the database, without any right to write in it.
let read_only_database = UserActivityDatabase::open_read_only(&default_database_path())?;
let rows = read_only_database.query("SELECT startedAt, endedAt FROM user_activity_records ORDER BY endedAt DESC LIMIT 5")?;
```

The calls are blocking: a caller in an async program runs them with `tokio::task::spawn_blocking`. The method `query` works only on a database that is open with `open_read_only`.

## Commands

Run these commands from the root of the repository.

```sh
pnpm --silent data_layer:user_activity --help      # show the help
pnpm --filter data_layer_user_activity test        # run the Rust tests (cargo test)
```

## Operation log

Every public function of this package writes a start line and an end line in the operation log of the data layer, with the library [data_layer_operation_log](../data_layer_operation_log/README.md): the package `user_activity`, the operation, the parameters that decide the workload, the duration, and the outcome. A synchronization, its collection, its writes, and its lock appear as nested operations. The command `heidrun_data operations summary` shows the usage patterns and the durations, and `heidrun_data operations replay` runs a recorded operation again. The log never changes a result and never holds a secret. The description is in [data_layer_operation_log.md](../../../docs/statistics/data_layer_operation_log.md).
