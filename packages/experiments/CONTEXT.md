# Directory Context: `/packages/experiments`

## Purpose
The packages of experiments: code that tries an idea outside the application, so that the experiment does not change the real project.

## Key Exports & Entry Points
- `multi_layer_graph/`: a command line tool that builds the multi-layer graph of a repository from the SQLite file of the data layer packages, and a page that shows the graph in 2D and in 3D. See its own CONTEXT.md.

## Rules
- A package that only tries an idea goes in this folder.
- No package outside this folder imports a package from this folder, and the application does not need any of them to run.
- A package in this folder never writes the SQLite file of the data layer packages. It opens the file read only.

## Background
- The folder comes from [issue #510](https://github.com/heidrun-org/heidrun/issues/510) and its plan, [issue #530](https://github.com/heidrun-org/heidrun/issues/530).
