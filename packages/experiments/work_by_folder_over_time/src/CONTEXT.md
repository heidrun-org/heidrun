# Directory Context: `/packages/experiments/work_by_folder_over_time/src`

## Purpose
This folder validates the command line inputs, reads Git history, groups line changes by folder and ten-minute UTC interval, and creates the animated report HTML.

## Key Exports & Entry Points
- `index.ts`: the public interface for the experiment package.
- `cli.ts`: the command line entry point that writes the report.
- `git_activity_reader.ts`: reads Git commits and per-file line counts.
- `workspace_folder_reader.ts`: reads the current folder hierarchy and skips generated and dependency folders.
- `folder_activity_builder.ts`: groups selected changes by folder and ten-minute interval.
- `report_builder.ts`: writes the self-contained HTML content.

## Rules
- Keep Git process execution in `GitActivityReader`.
- Build the visible folder hierarchy from current folders on disk, not from historical Git paths.
- Keep HTML escaping in `ReportBuilder` before inserting values into the page.
- Keep the ten-minute activity intervals in the report data; the page aggregates descendant folders for each folder circle.

## Background
- The experiment follows [issue #627](https://github.com/heidrun-org/heidrun/issues/627).
