# data_layer_source_control

A Rust library and a command line tool for [Heidrun](../../../README.md). Both read every commit of a Git repository, merges included, and write the facts of each one in the table `commits` of a SQLite file. It is the Source control source of the data layer of Heidrun. The data layer as a whole is [issue 452](https://github.com/heidrun-org/heidrun/issues/452), and this package comes from [issue 462](https://github.com/heidrun-org/heidrun/issues/462). The name `data_layer_source_control` is the name of the package and the name of the executable. The package has the same structure as [data_layer_code_hosting](../data_layer_code_hosting/README.md), and the two packages write in the same SQLite file.

## What it contains

- `src/lib.rs`: the public interface of the library.
- `src/main.rs` and `src/command_line.rs`: the command line. It is the executable `data_layer_source_control`.
- `src/git/`: the reading of Git. The file `git_runner.rs` is the only code that runs the command `git`. The file `git_reader.rs` lists the commits and turns the answer of `git log` into the stored shape.
- `src/storage/`: the SQLite file. The file `database.rs` holds the file and its table. The file `query_formatter.rs` writes the rows of a query as a text table or as JSON.
- `src/model/`: the facts. The file `types.rs` holds the data shapes. The file `schemas.rs` checks a commit against its JSON schema.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the file `commit.schema.json`. It is the only place that says which fields the database stores.
- `tests/`: the tests of the executable, with a real Git repository in a temporary folder. The tests of the library sit at the end of each source file.

## Command line

Run the command from the root of the repository, with the npm script `data_layer:source_control`. The option `--silent` of `pnpm` removes the lines that `pnpm` prints before the answer, which a program that reads the answer needs. The first run builds the executable, which takes some time. It has three commands: `initialize` and `update` fill the database, and `query` reads it. The commands `initialize` and `update` need the command `git`.

```sh
pnpm --silent data_layer:source_control initialize                   # read every commit
pnpm --silent data_layer:source_control update                       # read only the commits that are not in the database
pnpm --silent data_layer:source_control update --verbose             # the same, and print the progress
pnpm --silent data_layer:source_control initialize --database /path/to/a.sqlite --repository heidrun-org/heidrun --folder /path/to/a/repository
pnpm --silent data_layer:source_control query "SELECT count(*) AS count FROM commits"
```

The command runs in the folder of the package, so give a database file with an absolute path. The folder of the package is inside the repository of Heidrun, so the command reads the repository of Heidrun when the option `--folder` is not given.

| Option | Commands | Effect |
| --- | --- | --- |
| `--database <path>` | all three | The SQLite file. The default is `~/.config/heidrun/data_layer.sqlite`. The commands `initialize` and `update` create the file and its folder when they do not exist. The command `query` needs the file to exist. |
| `--repository <owner/name>` | `initialize`, `update` | The name of the repository in the database. The default comes from the address of the remote `origin`, for GitHub and for GitLab alike. |
| `--folder <path>` | `initialize`, `update` | The folder of the Git repository, or a folder inside it. The default is the current folder. |
| `--verbose` | `initialize`, `update` | Prints the progress on the standard error output: the number of commits, each batch that is read, and each write. The report stays on the standard output. |
| `--json` | `query` | Prints the rows as a JSON list, and not as a text table. |
| `--help` | all three | Shows the description and the options. |

How the two modes work:

- Both modes read the commits that the local branches, the remote branches, and the tags reach.
- `initialize` reads every one of these commits, and writes all the rows.
- `update` reads only the commits whose hash is not in the table for the repository, and adds only these rows. It does not depend on the dates of the commits, so a commit with an old date, for example from a branch that arrives late, is read too.
- Each mode can run again and again. A row that is already in the table is replaced, and no row is written two times.
- A row is never deleted. A commit that no branch reaches any more, for example after a rebase, stays in the table.
- The command prints a report of two lines on the standard output. It exits with code 1 and prints an error message on the standard error output when the command `git` fails, for example when the folder is not in a Git repository, or when the repository has no remote `origin` and the option `--repository` is not given.

## The database

The table `commits` has these four columns, and no other column:

| Column | Content |
| --- | --- |
| `repository` | The repository, in the format `owner/name`. |
| `hash` | The hash of the commit. |
| `committedAt` | The date when the commit was made, in UTC, in the format ISO 8601. |
| `data` | The JSON text of the commit. |

The primary key is `repository` and `hash`. The fields of the column `data` follow the JSON schema in the folder `schemas`:

| Field | Content |
| --- | --- |
| `hash` | The hash of the commit. |
| `parents` | The hashes of the parent commits. The list is empty for the first commit, and has two or more hashes for a merge. |
| `authorName`, `authorEmail`, `authoredAt` | The author and the date when the author wrote the commit, in UTC. The name and the email follow the file `.mailmap`. |
| `committerName`, `committerEmail`, `committedAt` | The committer and the date when the commit was made, in UTC. |
| `subject`, `body` | The first line of the message, and the rest of it. |
| `filesChanged`, `insertions`, `deletions` | The number of files, of added lines, and of deleted lines. For a merge, the counts compare it with its first parent, so they say what the merge brings in. A binary file counts 0 lines. |

The database stores facts only: no text of a change, no path of a file, no name of a branch, and no name of a tag. Every commit is checked against its JSON schema before it is written, and a wrong commit writes nothing. A merge is a commit with two or more parents: `json_array_length(data, '$.parents') > 1`.

The default SQLite file is the file of the other data layer packages. Each package creates and writes only its own tables in it.

## Query

The command `query` runs one SQL statement and prints the rows. It opens the database read only, so a statement that writes fails with the error "attempt to write a readonly database", and the file never changes. The column `data` holds JSON, so use the JSON functions of SQLite, for example `json_extract(data, '$.subject')`.

```sh
pnpm --silent data_layer:source_control query "SELECT substr(committedAt, 1, 10) AS day, json_extract(data, '$.subject') AS subject FROM commits ORDER BY committedAt DESC LIMIT 5"
```

The default output is a text table: a line of column names, a line of dashes, one line for each row, and the row count. A null value is written `NULL`. With `--json`, the output is a JSON list with one object for each row, for another program to read:

```sh
pnpm --silent data_layer:source_control query --json "SELECT count(*) AS merges FROM commits WHERE json_array_length(data, '$.parents') > 1"
```

The command exits with code 1 and prints an error message on the standard error output when the statement is wrong, or when the database file does not exist. The command `sqlite3` of macOS also opens the file, with the same statements.

### Four example queries

Each query works on the real database. The dates are in UTC.

The number of commits and the number of merges on each day, the newest day first:

```sh
pnpm --silent data_layer:source_control query "SELECT substr(committedAt, 1, 10) AS day,
       count(*) AS commits,
       sum(json_array_length(data, '$.parents') > 1) AS merges
FROM commits
GROUP BY day
ORDER BY day DESC
LIMIT 10"
```

The number of commits of each author:

```sh
pnpm --silent data_layer:source_control query "SELECT json_extract(data, '$.authorName') AS author, count(*) AS commits
FROM commits
GROUP BY author
ORDER BY commits DESC"
```

The number of added lines and of deleted lines on each day:

```sh
pnpm --silent data_layer:source_control query "SELECT substr(committedAt, 1, 10) AS day,
       sum(json_extract(data, '$.insertions')) AS insertions,
       sum(json_extract(data, '$.deletions')) AS deletions
FROM commits
GROUP BY day
ORDER BY day DESC
LIMIT 10"
```

The commits that mention one issue, here the issue 446. The match is plain text: `#44` also matches `#446`.

```sh
pnpm --silent data_layer:source_control query "SELECT hash, json_extract(data, '$.subject') AS subject
FROM commits
WHERE json_extract(data, '$.subject') LIKE '%#446%' OR json_extract(data, '$.body') LIKE '%#446%'
ORDER BY committedAt"
```

## Library

The desktop application can use the library as a path dependency, as it does for `raw_coding_agent_cli`:

```toml
data_layer_source_control = { path = "../../data_layers/data_layer_source_control" }
```

```rust
use data_layer_source_control::{
    default_database_path, find_repository, ignore_log, synchronize, GitCommandRunner, GitReader,
    SourceControlDatabase, SynchronizationMode,
};

// Fill the database.
let folder = std::path::Path::new("/path/to/a/repository");
let repository = find_repository(folder)?;
let mut database = SourceControlDatabase::open(&default_database_path())?;
let runner = GitCommandRunner::new(folder);
let reader = GitReader::new(&runner, &ignore_log);
let report = synchronize(SynchronizationMode::Update, &repository, &mut database, &reader, &ignore_log)?;

// Read the database, without any right to write in it.
let read_only_database = SourceControlDatabase::open_read_only(&default_database_path())?;
let rows = read_only_database.query("SELECT hash FROM commits WHERE json_array_length(data, '$.parents') > 1")?;
```

The calls are blocking: a caller in an async program runs them with `tokio::task::spawn_blocking`. The trait `GitRunner` runs one `git` command, and the tests give a fake runner for the errors. The method `query` works only on a database that is open with `open_read_only`.

## Commands

Run these commands from the root of the repository.

```sh
pnpm --silent data_layer:source_control --help      # show the help
pnpm --filter data_layer_source_control test        # run the Rust tests (cargo test)
```
