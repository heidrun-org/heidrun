# data_layer_operation_log

`data_layer_operation_log` is the Rust library that records every operation that the data layer receives. Each public function of the four data layer packages and of `heidrun_data` writes two lines in one file, `data_layer_operations.jsonl`: one when the operation starts and one when it ends. The lines tell who asked (the application or a command line), which operation name, with which parameters, how long it took, and how it ended. An operation that never ended stays visible.

The command that reads the file is `heidrun_data operations`:

```bash
pnpm --silent data_layer:heidrun_data operations summary
pnpm --silent data_layer:heidrun_data operations list --slowest --limit 20
pnpm --silent data_layer:heidrun_data operations replay --id <operation id> --database <snapshot> --repeat 5
pnpm --silent data_layer:heidrun_data operations overhead
```

The log file is in the folder of the variable `HEIDRUN_DIR`, else in `~/.config/heidrun`. The variable `HEIDRUN_OPERATION_LOG_FILE` gives another file, and the value `off` turns the log off. The full description, the format, and the measures are in [data_layer_operation_log.md](../../../docs/statistics/data_layer_operation_log.md). The rules of the package are in [CONTEXT.md](CONTEXT.md). Run `pnpm --filter data_layer_operation_log test` to test the package.
