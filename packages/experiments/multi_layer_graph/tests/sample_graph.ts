import type { LayerId, MultiLayerGraph } from '../src/graph/multi_layer_graph_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SampleGraph — a small multi-layer graph for the tests of the page
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Makes a small multi-layer graph for the tests of the page.
 */
export class SampleGraph {
	/**
	 * Makes a graph with two issues, one pull request, and one commit, and three links.
	 * @returns The multi-layer graph.
	 */
	static make(): MultiLayerGraph {
		return {
			repository: 'heidrun-org/heidrun',
			builtAt: '2026-10-15T12:00:00.000Z',
			layers: [
				{
					id: 'issues',
					name: 'Issues',
					nodeCount: 2,
				},
				{
					id: 'pull_requests',
					name: 'Pull requests',
					nodeCount: 1,
				},
				{
					id: 'commits',
					name: 'Commits',
					nodeCount: 1,
				},
			],
			nodes: [
				SampleGraph._node('issue:1', 'issues', 'Issue 1: The bug in the parser'),
				SampleGraph._node('issue:2', 'issues', 'Issue 2: A new layout'),
				SampleGraph._node('pull_request:3', 'pull_requests', 'Pull request 3: Fix the parser'),
				SampleGraph._node('commit:aaa', 'commits', 'Commit: Merge pull request #3'),
			],
			links: [
				{
					source: 'pull_request:3',
					target: 'issue:1',
					kind: 'fixes',
				},
				{
					source: 'pull_request:3',
					target: 'commit:aaa',
					kind: 'merge_commit',
				},
				{
					source: 'commit:aaa',
					target: 'issue:1',
					kind: 'mentions',
				},
			],
		};
	}

	/**
	 * Makes one node with no fact.
	 * @param id The identifier of the node.
	 * @param layerId The layer of the node.
	 * @param label The label of the node.
	 * @returns The node.
	 */
	private static _node(id: string, layerId: LayerId, label: string): MultiLayerGraph['nodes'][number] {
		return {
			id,
			layerId,
			label,
			url: null,
			facts: [],
		};
	}
}
