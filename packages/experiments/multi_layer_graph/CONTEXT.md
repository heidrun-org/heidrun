# Directory Context: `/packages/experiments/multi_layer_graph`

## Purpose
An experiment: a command line tool reads the SQLite file of the data layer packages and writes the multi-layer graph of one repository in the file `public/graph.json`, and a page shows the graph in 2D with Cytoscape.js.

## Key Exports & Entry Points
- `src/index.ts`: the public interface for another package of `packages/experiments`. It exports the types and the Zod schemas of the multi-layer graph, `GraphBuilder`, `DataLayerReader`, and `ReferenceParser`.
- `src/cli.ts`: the command line that writes `public/graph.json`.
- `src/graph/`: the types and the Zod schemas of the file `graph.json` — see its own CONTEXT.md.
- `src/builder/`: the reading of the SQLite file, and the building of the graph — see its own CONTEXT.md.
- `src/viewer/`: the page of the experiment, which `index.html` loads — see its own CONTEXT.md.
- `tests/`: the Vitest tests. `tests/test_database.ts` creates temporary SQLite files with the tables of the data layer packages, and only the tests import it.
- Command to write the graph, then open the page: `pnpm experiment:multi_layer_graph` at the root of the repository.
- Command to write the graph only: `pnpm --filter multi_layer_graph graph:build`
- Command to test this folder: `pnpm --filter multi_layer_graph test`

## Rules
- The package imports no data layer package: the data layer packages share only the SQLite file.
- Only `src/builder/data_layer_reader.ts` opens the SQLite file, and always read only.
- Git ignores `public/graph.json`, because it holds the data of the repository.

## Background
- The experiment comes from [issue #510](https://github.com/heidrun-org/heidrun/issues/510), and its plan is [issue #530](https://github.com/heidrun-org/heidrun/issues/530).
