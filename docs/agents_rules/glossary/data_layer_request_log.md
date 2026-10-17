# Glossary of Heidrun: the request log of the data layer

- Created: 17 October 2026
- Last updated: 17 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](index.md), [Rule: every request to the data layer is recorded in the request log](../data_layer_request_log.md), [The request log of the data layer](../../statistics/data_layer_request_log.md)
- Related issue: [issue 618](https://github.com/heidrun-org/heidrun/issues/618)

This document gives one short definition for each word of the request log of the data layer. The other words of Heidrun are in [index.md](index.md).

### Request

One call of a public operation of a data layer package or of `heidrun_data`. A request has a start event and a completion event in the request log. A request that has a start event and no completion event is an unfinished request.

### Request log

The file `data_layer_requests.jsonl`, with one JSON line for each event. The application and the command line `heidrun_data` write it, and the command `heidrun_data requests` reads it. When it reaches 8 MiB, it becomes `data_layer_requests.jsonl.1`, and a new file starts.

### Start event and completion event

The two lines of a request. The start event is written before the operation works, and holds the caller, the package, the operation, the parameters, the pattern, and the state of the data. The completion event is written after the operation, and holds the duration, the outcome, the category of the error, and the number of results.

### Caller

The program that made the request: `heidrun` for the desktop application, `heidrun_data` for the command line. The variable `HEIDRUN_REQUEST_LOG_CALLER` replaces it.

### Kind

What a request does with the data: `query` (reads the rows that the SQLite file holds), `collection` (reads a source), `synchronization` (the mode initialize or update of a source), `write` (writes rows in the SQLite file), or `lock` (waits for the lock of the SQLite file).

### Workload

The word that a summary gives to a group of requests: `stored_data_query`, `collection`, `initial_import` (a synchronization in the mode initialize), `incremental_synchronization` (a synchronization in the mode update), `synchronization` (a synchronization with no mode, such as the refresh of the prices), `database_write`, or `lock_wait`.

### Nested request

A request that starts while another request runs on the same thread, for example the lock inside a synchronization. A summary does not count a nested request as a request of its own, unless the option `--nested` is given.

### Pattern

The text that groups the requests that ask for the same thing with other values: the SQL statement without its values, and the choices of the request.

### Unfinished request

A request with no completion event. It is `running` when its process lives and it started less than one hour ago, and `interrupted` in every other case. It is never shown as a success.

### Replay

A request that the command `heidrun_data requests replay` runs again. Its events have the origin `replay` and the identifier of the original request. A summary of the real usage leaves it out.

### Snapshot

A consistent copy of the SQLite file, made by `heidrun_data requests snapshot`. A replay of queries reads it.

### Isolated database

The new SQLite file that a replay of a synchronization writes. It must not exist before the replay, so a replay never writes a file that exists.
