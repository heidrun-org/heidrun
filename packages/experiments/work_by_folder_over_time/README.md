# Work by folder over time

This experiment reads the Git history for one workspace folder and writes a self-contained animated HTML page. Folders appear as circles whose size, color, glow, and breathing animation show changed lines in ten-minute UTC intervals. The circles stay centered while their activity changes. The page can be opened as a local file without an application server.

Run the report from the repository root:

```bash
pnpm experiment:work_by_folder_over_time \
  --workspace-folder /path/to/workspace \
  --start-time 2026-09-01T00:00:00Z \
  --end-time 2026-10-01T00:00:00Z
```

The report is written to `packages/experiments/work_by_folder_over_time/public/report.html`. Pass `--output <path>` to choose another location. The time range includes `start_time` and excludes `end_time`. Both values must be ISO 8601 timestamps with a time zone. Commits are grouped into ten-minute intervals beginning on UTC clock boundaries, such as 10:20 and 10:30. Each view shows only folders that currently exist directly inside the selected folder. Use the folder path at the top of the page to move one level at a time. Use the timeline to scrub, play, pause, stop, and choose speeds from 1× to 64×. Select Loop to return to the first interval automatically when playback reaches the end. Open the generated file in a browser to inspect it.

Each circle shows activity from its folder and all child folders. The activity count is the added lines plus the deleted lines in that ten-minute interval; a binary file change contributes zero lines. Commits use their committer date, and UTC intervals avoid local daylight-saving changes. The selected workspace folder can be the repository root or a folder inside the repository. Existing folders remain visible when they had no activity in the selected time range. The report skips `.git`, `node_modules`, `target`, `dist`, `build`, `.cache`, and `.turbo` directories.
