# Directory Context: `/packages/data_layers/data_layer_source_control`

## Purpose
A Rust library and a command line tool that read every commit of a Git repository, merges included, and write the facts of each one in the table `commits` of a SQLite file. It is the Source control source of the data layer of Heidrun. The desktop application can use the library. The name `data_layer_source_control` is the name of the package and the name of the executable.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `SourceControlDatabase`, `GitReader`, `GitRunner`, `GitCommandRunner`, `synchronize`, `to_table`, `to_json`, `find_repository`, `parse_repository`, `default_database_path`, `validate_commit_value`, `COMMIT_SCHEMA` (the text of the JSON schema), and the data types.
- `src/main.rs`: the command line, and the executable `data_layer_source_control`. The module `src/command_line.rs` reads its arguments.
- `src/git/`: the reading of the commits, through a `GitRunner` — see its own CONTEXT.md.
- `src/storage/`: the SQLite file, and the text form of the rows of a query — see its own CONTEXT.md.
- `src/model/`: the data types, and the JSON schema check — see its own CONTEXT.md.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the file `commit.schema.json`. It is the only place that says which fields the database stores.
- `tests/`: the tests of the executable, with a real Git repository in a temporary folder. The tests of the library sit at the end of each source file, and `src/test_samples.rs` holds their sample data and their real Git repository.
- Command to run this folder: `pnpm --silent data_layer:source_control --help`
- Command to test this folder: `pnpm --filter data_layer_source_control test`

## Rules
- The SQLite file has one table of this package, `commits`, with exactly the columns `repository`, `hash`, `committedAt`, and `data`. The primary key is `repository` and `hash`. The column `data` holds the JSON text of the commit. The facts are never split into more columns. A merge is a commit whose `data` has two or more parents.
- Every commit is checked against its JSON schema before it is written, and a wrong commit writes nothing. The program holds the schema file inside with `include_str!`.
- `initialize` reads every commit that the local branches, the remote branches, and the tags reach. `update` reads only the commits whose hash is not in the table, so it never depends on the dates of the commits. Each mode can run again and again, and never writes a row two times.
- The package keeps no other state, and no extra table. A row is never deleted: a commit that no branch reaches any more, for example after a rebase, stays in the table.
- Only `src/git/git_runner.rs` runs the command `git`. The tests use a real Git repository with a fixed author, a fixed date, and no configuration file of the developer, and a fake runner for the errors.
- The dates are in UTC. The runner sets the time zone of the command `git` to UTC, and the reader asks for the format `format-local`.
- The line counts of a merge compare it with its first parent. The package stores facts only: no text of a change, no path of a file, no name of a branch, and no name of a tag, because a branch and a tag move.
- The default SQLite file is `~/.config/heidrun/data_layer.sqlite`, the same file as the other data layer packages. Each package creates and writes only its own tables with `CREATE TABLE IF NOT EXISTS`, and never changes a table of another package. The option `--database` changes it.
- `query` and `SourceControlDatabase::query` only work on a database that is open read only, so a query never changes the file and never creates it. `src/storage/query_formatter.rs` only turns rows into text.
- The option `--verbose` prints the progress on the standard error output. The code sends the progress lines to a log function and never prints them itself, except `src/main.rs`.
- The folder `src/model/` imports from no other folder of `src/`. The folder `src/git/` and the folder `src/storage/` import from `src/model/` only, and never from each other. Only `src/synchronization.rs` uses `src/git/` and `src/storage/` together.
- The library calls are blocking. The package imports nothing from another package of the repository, and it knows nothing about Tauri.
- The name of the repository comes from the address of the remote `origin`, for GitHub and for GitLab alike. The option `--repository` replaces it.
- The structure copies `data_layer_code_hosting`. The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`, so the folder that `pnpm worktree:create` clones is the only one. Cargo reads this file only when it runs inside this folder.

## Background
- The package comes from [issue #462](https://github.com/heidrun-org/heidrun/issues/462). The data layer as a whole is [issue #452](https://github.com/heidrun-org/heidrun/issues/452).
- The package gave the same counts as Git for the 755 commits and the 225 merges of this repository, and the same line counts as `git diff --numstat` for 72 commits that were checked.
- The Statistics window uses the package in `packages/apps/desktop_tauri/src/person_work.rs` ([issue #482](https://github.com/heidrun-org/heidrun/issues/482)). The other features of the desktop application still run `git` themselves in `git.rs` and `git_source_control.rs`.
