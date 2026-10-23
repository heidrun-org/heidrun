# Directory Context: `/packages/data_layers/data_layer_operation_log`

## Purpose
A Rust library that writes the operation log of the data layer: a start event before and a completion event after each public function of the four data layer packages and of `heidrun_code_data`. It also reads the log, groups the operations into usage patterns with their durations, and measures what the log costs. It has no executable: the command is `heidrun_code_data operations`.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface. It exports `record`, `record_value`, `Operation`, `OperationSpec`, `Summary`, and `replaying` (write the events), `Event`, `StartEvent`, `CompleteEvent`, `OperationKind`, and `FORMAT_VERSION` (the record format), `Logger`, `LogSettings`, and `set_default_caller` (the file, its size, the caller), `redact_text` and `normalize_sql`, `read_log`, `Filter`, `filter_operations`, `summarize`, and `GroupBy` (read and group), `measure_overhead`, and the module `testing` (read back the events in a test).
- Command to test this folder: `pnpm --filter data_layer_operation_log test`

## Rules
- Writing the log never changes the result of an operation, never hides its error, and never fails the operation. A line that cannot be written is counted, and the next line that is written reports the count in `droppedEvents`.
- A line is written with one write on a file open for append, so programs that write together never mix their lines. The file is replaced at 8 MiB and the old file is `<file>.1`.
- The log never holds a secret or the text of a source. Every text goes through `redact_text`, a field whose name says it holds a secret is replaced, and only the category of an error is written, never its text.
- The log never opens the SQLite file and never takes its lock. The only facts about the file are its size and its time of last change, read with `stat`.
- The nesting follows the call stack of one thread. An operation in another thread is not nested.
- A change to a name or to the meaning of a field adds one to `FORMAT_VERSION`. A new optional field does not. A reader skips and counts the lines of a version that it does not know.
- The operation names, the kinds, and the parameter names are the stable interface that the summaries and the replay read. Rename one only with a new `FORMAT_VERSION`.
- The test programs of Cargo write no log unless `HEIDRUN_CODE_OPERATION_LOG_FILE` gives a file. The cost of an operation must stay under 1 millisecond and 2 KiB, and a test fails when it does not.
- The package imports no other package of the repository, and it knows nothing about Tauri and SQLite. Every data layer package, `heidrun_code_data`, and `desktop_tauri` import it.

## Background
- The package comes from [issue #618](https://github.com/heidrun-org/heidrun/issues/618). It was named `request_log` and sat in `packages/auxiliary` until [issue #664](https://github.com/heidrun-org/heidrun/issues/664) moved it here and renamed "request" to "operation". The rules for agents are in [data_layer_operation_log.md](../../../docs/agents_rules/data_layer_operation_log.md), and the description with the measures is in [data_layer_operation_log.md](../../../docs/statistics/data_layer_operation_log.md).
- One shared package, and not a copy in each data layer package, gives one record format, one nesting across the packages, and one implementation of the rotation and of the redaction. The rule "no data layer package imports another data layer package" is unchanged.
