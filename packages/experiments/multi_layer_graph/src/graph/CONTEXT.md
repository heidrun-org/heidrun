# Directory Context: `/packages/experiments/multi_layer_graph/src/graph`

## Purpose
The types and the Zod schemas of the multi-layer graph: the layers, the nodes, the links, and the file `graph.json` that holds them.

## Key Exports & Entry Points
- `multi_layer_graph_types.ts`: `MultiLayerGraphSchema` and the schemas and types of its parts.

## Rules
- This folder imports from no other folder of `src`.
- The file `graph.json` holds facts only, never a color or a size: the page chooses the look.

## Background
- The layers and the links come from the plan, [issue #530](https://github.com/heidrun-org/heidrun/issues/530).
