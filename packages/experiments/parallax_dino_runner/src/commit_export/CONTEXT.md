# Directory Context: `/packages/experiments/parallax_dino_runner/src/commit_export`

## Purpose
The script that reads the Git history of a folder and writes the file `public/commits.json`, which the page of the game reads. It runs in Node.js, never in the browser, and it needs no network.

## Key Exports & Entry Points
- `cli.ts`: `Cli`, the command line: `pnpm experiment:parallax_dino_runner:commits`. The option `--git-folder <path>` gives the repository, and the option `--output <path>` gives the file.
- `commit_exporter.ts`: `CommitExporter`, which reads the history, gives the lanes, and writes the file with one commit on each line.
- `git_commit_reader.ts`: `GitCommitReader`, the only code that runs the command `git`.
- `lane_assigner.ts`: `LaneAssigner`, which puts the commits in order and gives each commit its lane. It uses no file and no command.
- `commit_export_types.ts`: `RawCommit`, a commit as the command `git log` gives it.

## Rules
- Only `git_commit_reader.ts` runs the command `git`. It reads the commits that the local branches, the remote branches, and the tags reach, and it never changes the folder.
- The lines of a merge commit are compared with its first parent, as in the package `data_layer_source_control`.
- The order puts every parent before its children, and the older commit first when it can. The main line is the longest chain of first parents, and it goes in the middle lane. Every other chain of first parents is a feature line, in the lane 0 or in the lane 2. A line takes a lane that is free when it starts, the lane that was free for the longest time first. When no lane is free, the line shares the lane of the line that ends first.
- The code imports from `src/game/` only through `src/index.ts`. Nothing in `src/game/` or `src/view/` imports this folder.
- The command never writes a file when it fails, and it prints the error on the standard error output with the exit code 1.

## Background
- The folder comes from [issue #540](https://github.com/heidrun-org/heidrun/issues/540). The script runs `git` itself, and not the data layer package, so a person can make the game for any repository with nothing else than Git.
