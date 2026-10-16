# Directory Context: `/packages/experiments`

## Purpose
The packages of experiments: code that tries an idea outside the application, so that the experiment does not change the real project.

## Key Exports & Entry Points
- `parallax_dino_runner/`: a static web page with a game: a dinosaur like the dinosaur of Chrome Dino runs through the commits of a Git repository, in three lanes, in front of parallax layers. A script writes the commits in a JSON file. See its own CONTEXT.md.
- `promotional_videos/`: the working folder to try promotional marketing videos that a coding agent makes: a headless browser records the game, and `ffmpeg` adds the intro, the comic words, and the outro. See its own CONTEXT.md.
- `multi_layer_graph/`: a command line tool that builds the multi-layer graph of a repository from the SQLite file of the data layer packages, and a page that shows the graph in 2D and in 3D. See its own CONTEXT.md.

## Rules
- A package that only tries an idea goes in this folder.
- No package outside this folder imports a package from this folder, and the application does not need any of them to run.
- A package in this folder never writes the SQLite file of the data layer packages. It opens the file read only.

## Background
- The folder comes from [issue #510](https://github.com/heidrun-org/heidrun/issues/510) and its plan, [issue #530](https://github.com/heidrun-org/heidrun/issues/530).
- The package `promotional_videos` comes from [issue #548](https://github.com/heidrun-org/heidrun/issues/548).
- The package `parallax_dino_runner` comes from [issue #536](https://github.com/heidrun-org/heidrun/issues/536) and its plans, [issue #538](https://github.com/heidrun-org/heidrun/issues/538) for stage 1 and [issue #540](https://github.com/heidrun-org/heidrun/issues/540) for stage 2.
