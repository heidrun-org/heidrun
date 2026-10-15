# Directory Context: `/packages/experiments/multi_layer_graph/src/viewer`

## Purpose
The page of the experiment: it loads `graph.json` and shows the multi-layer graph in 2D with Cytoscape.js, with the layer panel, the list of layouts, the search field, the label under the pointer, and the information card.

## Key Exports & Entry Points
- `multi_layer_graph_page.ts`: `MultiLayerGraphPage`, the entry of `index.html`. It connects the view and the panels.
- `cytoscape_view.ts`: `CytoscapeView`, the 2D view, drawn as CodeSpine draws its graph.
- `graph_query.ts`: `GraphQuery`, the degree, the neighbors, and the search, with no drawing.
- `layer_panel.ts`, `node_card.ts`, `shape_swatch.ts`, `html_escape.ts`: the markup of the panels.
- `viewer_styles.ts`: `ViewerStyles`, the colors and the shapes of the layers and of the links.

## Rules
- This folder imports only from `src/graph`, never from `src/builder`: the page reads only `graph.json`.
- Every text of the graph goes through `HtmlEscape.text` before it goes into HTML, because people wrote the titles.
- The colors of the layers are the categorical palette of the dataviz skill, for the light surface, in its fixed order. Each layer also has its own shape, so the shape tells the layers apart without the color.
- The page uses the classes of Bootstrap 6 (`check`, `form-control`, `fg-3`, `text-sm`), and the style block of `index.html` holds only the size of the panels and of the view.
- Only `cytoscape_view.ts` imports Cytoscape.js.

## Background
- The rendering copies CodeSpine ([graph.js](https://github.com/jeromeetienne/codespine/blob/main/contribs/webview/web/js/graph/graph.js)), as the step 2 of [issue #530](https://github.com/heidrun-org/heidrun/issues/530) asks.
- The page was dark first, and the developer could not see the graph, so it is light.
