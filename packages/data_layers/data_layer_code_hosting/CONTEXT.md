# Directory Context: `/packages/data_layers/data_layer_code_hosting`

## Purpose
A Rust library and a command line tool that read every issue and every pull request of a GitHub repository, and write the facts of each one in two tables of a SQLite file. It is the Code hosting source of the data layer of Heidrun. The desktop application uses the library through `refresh_code_hosting` and the functions `find_*`. The name `data_layer_code_hosting` is the name of the package and the name of the executable.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `CodeHostingDatabase`, `GithubReader`, `GraphqlRunner`, `GhGraphqlRunner`, `synchronize`, `to_table`, `to_json`, `find_repository`, `default_database_path`, `validate_issue_value`, `validate_pull_request_value`, `ISSUE_SCHEMA` and `PULL_REQUEST_SCHEMA` (the texts of the JSON schemas), and the data types.
- `src/refresh.rs` and `src/query.rs`: `refresh_code_hosting` copies the issues and pull requests that changed, and `find_issues_opened_between`, `find_pull_requests_opened_between`, `find_issues_by_numbers`, and `find_pull_requests_by_numbers` read the stored rows, from the SQLite file only. A query on a file that has no table of this package gives no row.
- `src/main.rs`: the command line, and the executable `data_layer_code_hosting`. The module `src/command_line.rs` reads its arguments.
- `src/github/`: the reading of the issues and of the pull requests of GitHub, through a `GraphqlRunner` — see its own CONTEXT.md.
- `src/storage/`: the SQLite file, and the text form of the rows of a query — see its own CONTEXT.md.
- `src/model/`: the data types, and the JSON schema checks — see its own CONTEXT.md.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the two JSON schema files `issue.schema.json` and `pull_request.schema.json`. They are the only place that says which fields the database stores.
- `tests/`: the tests of the executable, with a fake `gh` command put at the start of the PATH. The tests of the library sit at the end of each source file, and `src/test_samples.rs` holds their sample data and their fake GitHub.
- Command to run this folder: `pnpm --silent data_layer:code_hosting --help`
- Command to test this folder: `pnpm --filter data_layer_code_hosting test`

## Rules
- The SQLite file has two tables, `issues` and `pull_requests`. Each table has exactly the columns `repository`, `number`, `updatedAt`, and `data`, and the primary key is `repository` and `number`. The column `data` holds the JSON text of the item. The facts are never split into more columns.
- Every item is checked against its JSON schema before it is written, and a wrong item writes nothing. The program holds the two schema files inside with `include_str!`.
- `initialize` reads every item since the beginning. `update` reads only the items that changed since the last read. Each mode can run again and again, and never writes a row two times.
- The date of the last read is the largest `updatedAt` of the table for the repository. The package keeps no other state, and no extra table.
- Only `src/github/graphql_runner.rs` runs the command `gh`. The tests give a fake runner or a fake `gh` command, so they need no network.
- The package stores facts only: no review, no reaction, no milestone, and no comment text.
- `query` and `CodeHostingDatabase::query` only work on a database that is open read only, so a query never changes the file and never creates it. `src/storage/query_formatter.rs` only turns rows into text.
- The default SQLite file is `~/.config/heidrun/data_layer.sqlite`. The option `--database` changes it.
- The option `--verbose` prints the progress on the standard error output. The code sends the progress lines to a log function and never prints them itself, except `src/main.rs`.
- The folder `src/model/` imports from no other folder of `src/`. The folder `src/github/` and the folder `src/storage/` import from `src/model/` only, and never from each other. Only `src/synchronization.rs` uses `src/github/` and `src/storage/` together.
- The library calls are blocking. The package imports nothing from another package of the repository, and it knows nothing about Tauri.
- The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`, so the folder that `pnpm worktree:create` clones is the only one. Cargo reads this file only when it runs inside this folder.
- The desktop application calls only the functions `refresh_*` and `find_*` of this package, as [data_layer_access.md](../../../docs/agents_rules/data_layer_access.md) says. The test of the package `data_layer_boundary_checker` fails otherwise.

## Background
- The package comes from [issue #455](https://github.com/heidrun-org/heidrun/issues/455). The data layer as a whole is [issue #452](https://github.com/heidrun-org/heidrun/issues/452).
- The field `closingIssuesReferences` of GitHub is empty for every pull request here, because the pull requests merge into `dev_jerome` and not into `main`. The link from a pull request to its issue is the text `Fixes #N` in the `body`.
- The support for GitLab is not written yet.
