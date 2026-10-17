# request_log

`request_log` is the Rust library that records every request that the data layer receives. Each public operation of the four data layer packages and of `heidrun_data` writes two lines in one file, `data_layer_requests.jsonl`: one when the request starts and one when it ends. The lines tell who asked (the application or a command line), which operation, with which parameters, how long it took, and how it ended. A request that never ended stays visible.

The command that reads the file is `heidrun_data requests`:

```bash
pnpm --silent data_layer:heidrun_data requests summary
pnpm --silent data_layer:heidrun_data requests list --slowest --limit 20
pnpm --silent data_layer:heidrun_data requests replay --id <request id> --database <snapshot> --repeat 5
pnpm --silent data_layer:heidrun_data requests overhead
```

The log file is in the folder of the variable `HEIDRUN_DIR`, else in `~/.config/heidrun`. The variable `HEIDRUN_REQUEST_LOG_FILE` gives another file, and the value `off` turns the log off. The full description, the format, and the measures are in [data_layer_request_log.md](../../../docs/statistics/data_layer_request_log.md). The rules of the package are in [CONTEXT.md](CONTEXT.md). Run `pnpm --filter request_log test` to test the package.
