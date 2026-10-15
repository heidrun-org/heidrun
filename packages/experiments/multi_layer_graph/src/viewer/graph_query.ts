import type { GraphNode, LayerId, MultiLayerGraph } from '../graph/multi_layer_graph_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GraphQuery — the questions that the page asks the multi-layer graph, with no drawing
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Answers the questions that the page asks the multi-layer graph: the degree of each node, the neighbors of a node,
 * the nodes of the layers that show, and the search. It draws nothing, so the 2D view and the 3D view share it.
 */
export class GraphQuery {
	/**
	 * Counts the links of each node. A node with no link has the degree 0.
	 * @param multiLayerGraph The multi-layer graph.
	 * @returns The degree of each node, by identifier.
	 */
	static degrees(multiLayerGraph: MultiLayerGraph): Map<string, number> {
		const degrees = new Map<string, number>();
		for (const graphNode of multiLayerGraph.nodes) {
			degrees.set(graphNode.id, 0);
		}
		for (const graphLink of multiLayerGraph.links) {
			degrees.set(graphLink.source, (degrees.get(graphLink.source) ?? 0) + 1);
			degrees.set(graphLink.target, (degrees.get(graphLink.target) ?? 0) + 1);
		}
		return degrees;
	}

	/**
	 * Finds the neighbors of a node: the nodes that one link joins to it, in either direction.
	 * @param multiLayerGraph The multi-layer graph.
	 * @param nodeId The identifier of the node.
	 * @returns The neighbors, in the order of the list of nodes of the graph.
	 */
	static neighbors(multiLayerGraph: MultiLayerGraph, nodeId: string): GraphNode[] {
		const neighborIds = new Set<string>();
		for (const graphLink of multiLayerGraph.links) {
			if (graphLink.source === nodeId) {
				neighborIds.add(graphLink.target);
			}
			if (graphLink.target === nodeId) {
				neighborIds.add(graphLink.source);
			}
		}
		const neighbors = multiLayerGraph.nodes.filter((graphNode) => neighborIds.has(graphNode.id));
		return neighbors;
	}

	/**
	 * Tells whether a node shows: its layer is not hidden.
	 * @param graphNode The node.
	 * @param hiddenLayerIds The layers that the developer hid.
	 * @returns True when the node shows.
	 */
	static isShown(graphNode: GraphNode, hiddenLayerIds: ReadonlySet<LayerId>): boolean {
		return hiddenLayerIds.has(graphNode.layerId) === false;
	}

	/**
	 * Finds the nodes that show and whose label holds a text, in any case.
	 * @param multiLayerGraph The multi-layer graph.
	 * @param text The text to find. A text of only spaces finds nothing.
	 * @param hiddenLayerIds The layers that the developer hid.
	 * @returns The nodes found, in the order of the list of nodes of the graph.
	 */
	static search(multiLayerGraph: MultiLayerGraph, text: string, hiddenLayerIds: ReadonlySet<LayerId>): GraphNode[] {
		const searchedText = text.trim().toLowerCase();
		if (searchedText === '') {
			return [];
		}
		const graphNodes = multiLayerGraph.nodes.filter((graphNode) => {
			if (GraphQuery.isShown(graphNode, hiddenLayerIds) === false) {
				return false;
			}
			return graphNode.label.toLowerCase().includes(searchedText);
		});
		return graphNodes;
	}

	/**
	 * Finds a node by identifier.
	 * @param multiLayerGraph The multi-layer graph.
	 * @param nodeId The identifier of the node.
	 * @returns The node, or null when no node has the identifier.
	 */
	static findNode(multiLayerGraph: MultiLayerGraph, nodeId: string): GraphNode | null {
		const graphNode = multiLayerGraph.nodes.find((candidateNode) => candidateNode.id === nodeId);
		return graphNode ?? null;
	}
}
