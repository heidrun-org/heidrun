# Directory Context: `/packages/experiments/multi_layer_graph/src/builder`

## Purpose
The reading of the SQLite file of the data layer packages, and the building of the multi-layer graph from its rows.

## Key Exports & Entry Points
- `data_layer_reader.ts`: `DataLayerReader`, the only code that opens the SQLite file.
- `graph_builder.ts`: `GraphBuilder`, which turns the rows into the multi-layer graph, with no input and no output.
- `reference_parser.ts`: `ReferenceParser`, which finds the numbers of the issues and of the pull requests that a text names.

## Rules
- This folder imports only from `src/graph`.
- The SQLite file is always open read only. A table that does not exist reads as a table with no row.
- `data_layer_row_types.ts` lists only the facts that the graph uses. The JSON schemas of the data layer packages stay the only place that says which facts the column `data` stores.
- `node_sqlite.ts` loads `node:sqlite` with `require`, because Vite 5, and so Vitest, fails on `import` of this module.
- A link joins two nodes that exist, never a node to itself, and a pair of nodes gets one link at most.

## Background
- The text `#N` goes to the issue N, else to the pull request N, because GitHub never gives one number to both.
