# Directory Context: `/packages/experiments`

## Purpose
The packages of experiments: code that tries an idea outside the application, so that the experiment does not change the real project.

## Key Exports & Entry Points
- `parallax_dino_runner/`: a static web page with a game: a dinosaur like the dinosaur of Chrome Dino runs through the commits of a Git repository, in three lanes, in front of parallax layers. A script writes the commits in a JSON file. See its own CONTEXT.md.
- `promotional_videos/`: the working folder to try promotional marketing videos that a coding agent makes: a headless browser records the game, and `ffmpeg` adds the intro, the comic words, and the outro. See its own CONTEXT.md.
- `multi_layer_graph/`: a command line tool that builds the multi-layer graph of a repository from the SQLite file of the data layer packages, and a page that shows the graph in 2D and in 3D. See its own CONTEXT.md.
- `work_by_folder_over_time/`: a command line experiment that generates a self-contained animation of Git activity by folder in ten-minute UTC intervals for one workspace folder. See its own CONTEXT.md.
- `localai_decisions_candle/`: a Rust library and a command line tool that run the decision model GLiNER2.5-Decide on the computer: it reads a text and a list of labels, and returns the label that matches the text. See its own CONTEXT.md.
- `localai_decisions_qwen35/`: a Rust library and a command line tool that run the decision models based on Qwen3.5 on the computer with llama.cpp: it reads a text and typed questions, and returns a probability for each option, as the System One API. See its own CONTEXT.md.
- `coding_agent_plugin/`: the temporary working folder for the plugin that groups the four shared skills; it holds a copy of the skill folders and no code. See its own CONTEXT.md.

## Rules
- A package that only tries an idea goes in this folder.
- No package outside this folder imports a package from this folder, and the application does not need any of them to run.
- A package in this folder never writes the SQLite file of the data layer packages. It opens the file read only.

## Background
- The folder comes from [issue #510](https://github.com/heidrun-org/heidrun/issues/510) and its plan, [issue #530](https://github.com/heidrun-org/heidrun/issues/530).
- The package `promotional_videos` comes from [issue #548](https://github.com/heidrun-org/heidrun/issues/548).
- The package `parallax_dino_runner` comes from [issue #536](https://github.com/heidrun-org/heidrun/issues/536) and its plans, [issue #538](https://github.com/heidrun-org/heidrun/issues/538) for stage 1 and [issue #540](https://github.com/heidrun-org/heidrun/issues/540) for stage 2.
- The package `coding_agent_plugin` comes from [issue #682](https://github.com/heidrun-org/heidrun/issues/682).
- The package `localai_decisions_candle` comes from [issue #717](https://github.com/heidrun-org/heidrun/issues/717).
- The package `localai_decisions_qwen35` comes from [issue #721](https://github.com/heidrun-org/heidrun/issues/721).
