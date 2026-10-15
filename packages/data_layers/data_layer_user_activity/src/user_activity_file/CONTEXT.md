# Directory Context: `/packages/data_layers/data_layer_user_activity/src/user_activity_file`

## Purpose
Reads the file `user_activity.jsonl`, which the web frontend writes: one JSON line for each active period of the developer. Each valid line becomes a record with its times in UTC.

## Key Exports & Entry Points
- `user_activity_file_reader.rs`: `UserActivityFileReader`, `UserActivityFileReading`, `user_activity_file_path`, `default_user_activity_file_path`, and `USER_ACTIVITY_FILE_NAME`.
- Command to test this folder: `pnpm --filter data_layer_user_activity test`

## Rules
- Nothing here imports from `src/storage/`.
- Nothing here writes the file. The reader only reads it.
- A line that is not valid UTF-8 text, not valid JSON, not a JSON object, or not a record that follows the JSON schema is skipped and counted, with its number and its reason sent to the log function. The reader checks the record again after the conversion to UTC, so a converted time never breaks the write.
- A file that does not exist gives an empty reading with `is_file_found` false. Any other error on the file, for example a path that is a folder, is an error.
- The path of the file follows the desktop application: the folder of the variable `HEIDRUN_DIR`, or else `~/.config/heidrun`. The function `user_activity_file_path` takes the value of the variable as an argument, so its test never changes the environment.
