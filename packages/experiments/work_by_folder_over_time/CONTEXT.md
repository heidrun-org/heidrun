# Directory Context: `/packages/experiments/work_by_folder_over_time`

## Purpose
This experiment reads the Git history for one workspace folder and writes a self-contained HTML animation of changed lines by folder in ten-minute UTC intervals.

## Key Exports & Entry Points
- `src/index.ts`: the public interface of the experiment.
- Command to write the report: `pnpm experiment:work_by_folder_over_time --workspace-folder <path> --start-time <ISO-8601> --end-time <ISO-8601>`.

## Rules
- The report reads Git history and writes the requested output file, creating its parent folder when needed.
- The selected time range includes `start_time` and excludes `end_time`; ten-minute interval buckets use UTC.
- The HTML page shows each folder as a circle. Its size, color, glow, and breathing animation follow the changed lines in the selected interval. Circle centers remain fixed while their activity changes.
- The folder hierarchy comes from directories that currently exist in the workspace; each view shows only immediate child folders. Dependency and generated output folders are skipped.
- Git line counts are attributed to the containing workspace folder of each changed file; binary files contribute zero lines.

## Background
- The experiment follows [issue #627](https://github.com/heidrun-org/heidrun/issues/627), a sub-issue of [issue #621](https://github.com/heidrun-org/heidrun/issues/621).
