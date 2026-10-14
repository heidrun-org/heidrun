# data_layer_code_hosting

A Rust library and a command line tool for [Heidrun](../../../README.md). Both read every issue and every pull request of a GitHub repository, and write the facts of each one in two tables of a SQLite file. It is the Code hosting source of the data layer of Heidrun. The data layer as a whole is [issue 452](https://github.com/heidrun-org/heidrun/issues/452), and this package comes from [issue 455](https://github.com/heidrun-org/heidrun/issues/455). The name `data_layer_code_hosting` is the name of the package and the name of the executable.

## What it contains

- `src/lib.rs`: the public interface of the library.
- `src/main.rs` and `src/command_line.rs`: the command line. It is the executable `data_layer_code_hosting`.
- `src/github_reader.rs`: the only code that runs the command `gh`. It reads the pages of issues and of pull requests, and turns them into the stored shape.
- `src/database.rs`: the SQLite file and its two tables.
- `src/schemas.rs`: checks an issue and a pull request against their JSON schema.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `src/query_formatter.rs`: writes the rows of a query as a text table or as JSON.
- `src/types.rs`: the data shapes.
- `schemas/`: the files `issue.schema.json` and `pull_request.schema.json`. They are the only place that says which fields the database stores.
- `tests/`: the tests of the executable, with a fake `gh` command. The tests of the library sit at the end of each source file.

## Command line

Run the command from the root of the repository, with the npm script `data_layer:code_hosting`. The option `--silent` of `pnpm` removes the lines that `pnpm` prints before the answer, which a program that reads the answer needs. The first run builds the executable, which takes some time. It has three commands: `initialize` and `update` fill the database, and `query` reads it. The commands `initialize` and `update` need the command `gh` of GitHub, signed in.

```sh
pnpm --silent data_layer:code_hosting initialize                     # read everything since the beginning
pnpm --silent data_layer:code_hosting update                         # read only what changed since the last read
pnpm --silent data_layer:code_hosting update --verbose               # the same, and print the progress
pnpm --silent data_layer:code_hosting initialize --database /path/to/a.sqlite --repository heidrun-org/heidrun
pnpm --silent data_layer:code_hosting query "SELECT count(*) AS count FROM issues"
```

The command runs in the folder of the package, so give a database file with an absolute path.

| Option | Commands | Effect |
| --- | --- | --- |
| `--database <path>` | all three | The SQLite file. The default is `~/.config/heidrun/data_layer.sqlite`. The commands `initialize` and `update` create the file and its folder when they do not exist. The command `query` needs the file to exist. |
| `--repository <owner/name>` | `initialize`, `update` | The GitHub repository. The default is the repository of the current folder, which the command `gh` finds. |
| `--verbose` | `initialize`, `update` | Prints the progress on the standard error output: each page that is read, each stop, and each write. The report stays on the standard output. |
| `--json` | `query` | Prints the rows as a JSON list, and not as a text table. |
| `--help` | all three | Shows the description and the options. |

How the two modes work:

- `initialize` reads every issue and every pull request since the beginning of the repository, and writes all the rows.
- `update` reads only the issues and the pull requests that changed since the last read, and adds or changes only these rows.
- The date of the last read is the largest value of the column `updatedAt` of the table, for the repository. The package keeps no other state. When a table has no row for the repository, `update` reads everything, as `initialize` does.
- GitHub gives the items from the newest change to the oldest change. `update` stops at the first item that is older than the date of the last read, so it asks for one page in the usual case.
- Each mode can run again and again. A row that is already in the table is replaced, and no row is written two times.
- The command prints a report of three lines on the standard output. It exits with code 1 and prints an error message on the standard error output when the command `gh` fails.

## The database

The SQLite file has two tables: `issues` and `pull_requests`. Each table has these four columns, and no other column:

| Column | Content |
| --- | --- |
| `repository` | The repository, in the format `owner/name`. |
| `number` | The number of the issue or of the pull request. |
| `updatedAt` | The date of the last change, in the format ISO 8601. |
| `data` | The JSON text of the issue or of the pull request. |

The primary key is `repository` and `number`. The fields of the column `data` follow the JSON schema in the folder `schemas`. The database stores facts only: no review, no reaction, no milestone, and no comment text. Every item is checked against its JSON schema before it is written, and a wrong item writes nothing.

The field `closingIssuesReferences` of GitHub is empty for every pull request of this repository, because the pull requests merge into `dev_jerome` and not into `main`. The link from a pull request to its issue is the text `Fixes #N` in the field `body`.

## Query

The command `query` runs one SQL statement and prints the rows. It opens the database read only, so a statement that writes fails with the error "attempt to write a readonly database", and the file never changes. The column `data` holds JSON, so use the JSON functions of SQLite, for example `json_extract(data, '$.state')`.

```sh
pnpm --silent data_layer:code_hosting query "SELECT number, json_extract(data, '$.state') AS state, json_extract(data, '$.title') AS title FROM issues ORDER BY number DESC LIMIT 5"
```

The default output is a text table: a line of column names, a line of dashes, one line for each row, and the row count. A null value is written `NULL`. With `--json`, the output is a JSON list with one object for each row, for another program to read:

```sh
pnpm --silent data_layer:code_hosting query --json "SELECT count(*) AS count FROM pull_requests"
```

The command exits with code 1 and prints an error message on the standard error output when the statement is wrong, or when the database file does not exist. The command `sqlite3` of macOS also opens the file, with the same statements.

### Five example queries

Each query works on the real database. The dates are in UTC, as GitHub gives them.

The open issues, the oldest first:

```sh
pnpm --silent data_layer:code_hosting query "SELECT number, substr(json_extract(data, '$.createdAt'), 1, 10) AS created, json_extract(data, '$.title') AS title
FROM issues
WHERE json_extract(data, '$.state') = 'OPEN'
ORDER BY number
LIMIT 10"
```

The ten closed issues that took the most time to close, with the time in hours between the creation and the close:

```sh
pnpm --silent data_layer:code_hosting query "SELECT number,
       round((julianday(json_extract(data, '$.closedAt')) - julianday(json_extract(data, '$.createdAt'))) * 24, 1) AS hours,
       json_extract(data, '$.title') AS title
FROM issues
WHERE json_extract(data, '$.state') = 'CLOSED'
ORDER BY hours DESC
LIMIT 10"
```

The speed of the closed issues as a histogram: how many issues were closed in less than one hour, in less than one day, in less than one week, and later ([issue 449](https://github.com/heidrun-org/heidrun/issues/449)):

```sh
pnpm --silent data_layer:code_hosting query "SELECT CASE
         WHEN hours < 1 THEN '1: less than 1 hour'
         WHEN hours < 24 THEN '2: less than 1 day'
         WHEN hours < 168 THEN '3: less than 1 week'
         ELSE '4: 1 week or more'
       END AS speed,
       count(*) AS issues
FROM (
  SELECT (julianday(json_extract(data, '$.closedAt')) - julianday(json_extract(data, '$.createdAt'))) * 24 AS hours
  FROM issues
  WHERE json_extract(data, '$.state') = 'CLOSED'
)
GROUP BY speed
ORDER BY speed"
```

The number of pull requests merged on each day, the newest day first:

```sh
pnpm --silent data_layer:code_hosting query "SELECT substr(json_extract(data, '$.mergedAt'), 1, 10) AS day, count(*) AS pull_requests
FROM pull_requests
WHERE json_extract(data, '$.state') = 'MERGED'
GROUP BY day
ORDER BY day DESC
LIMIT 10"
```

The pull requests that mention one issue, here the issue 446. The field `closingIssuesReferences` of GitHub is empty here, so the link is the text of the field `body`. The match is plain text: `#44` also matches `#446`.

```sh
pnpm --silent data_layer:code_hosting query "SELECT number, json_extract(data, '$.state') AS state, json_extract(data, '$.title') AS title
FROM pull_requests
WHERE json_extract(data, '$.body') LIKE '%#446%'
ORDER BY number"
```

## Library

The desktop application uses the library as a path dependency, as it does for `raw_coding_agent_cli`:

```toml
data_layer_code_hosting = { path = "../../auxiliary/data_layer_code_hosting" }
```

```rust
use data_layer_code_hosting::{
    default_database_path, ignore_log, synchronize, CodeHostingDatabase, GhGraphqlRunner, GithubReader,
    SynchronizationMode,
};

// Fill the database.
let mut database = CodeHostingDatabase::open(&default_database_path())?;
let runner = GhGraphqlRunner;
let reader = GithubReader::new(&runner, &ignore_log);
let report = synchronize(SynchronizationMode::Update, "heidrun-org/heidrun", &mut database, &reader, &ignore_log)?;

// Read the database, without any right to write in it.
let read_only_database = CodeHostingDatabase::open_read_only(&default_database_path())?;
let rows = read_only_database.query("SELECT number FROM issues WHERE json_extract(data, '$.state') = 'OPEN'")?;
let issue = read_only_database.find_issue("heidrun-org/heidrun", 455)?;
```

The calls are blocking: a caller in an async program runs them with `tokio::task::spawn_blocking`. The trait `GraphqlRunner` sends one GraphQL query. `GhGraphqlRunner` runs `gh api graphql`, and the tests give a fake runner, so they need no network. The method `query` works only on a database that is open with `open_read_only`.

## Commands

Run these commands from the root of the repository.

```sh
pnpm --silent data_layer:code_hosting --help      # show the help
pnpm --filter data_layer_code_hosting test        # run the Rust tests (cargo test)
```
