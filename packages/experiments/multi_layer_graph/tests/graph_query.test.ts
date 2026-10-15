import { describe, expect, it } from 'vitest';
import type { LayerId } from '../src/graph/multi_layer_graph_types.ts';
import { GraphQuery } from '../src/viewer/graph_query.ts';
import { SampleGraph } from './sample_graph.ts';

describe('GraphQuery', () => {
	it('counts the links of each node, and 0 for a node with no link', () => {
		const degrees = GraphQuery.degrees(SampleGraph.make());
		expect(Object.fromEntries(degrees)).toEqual({
			'issue:1': 2,
			'issue:2': 0,
			'pull_request:3': 2,
			'commit:aaa': 2,
		});
	});

	it('finds the neighbors of a node in both directions of the links', () => {
		const neighbors = GraphQuery.neighbors(SampleGraph.make(), 'issue:1');
		expect(neighbors.map((graphNode) => graphNode.id)).toEqual(['pull_request:3', 'commit:aaa']);
		expect(GraphQuery.neighbors(SampleGraph.make(), 'issue:2')).toEqual([]);
	});

	it('finds the nodes whose label holds the text, in any case, and not the nodes of a hidden layer', () => {
		const multiLayerGraph = SampleGraph.make();
		const foundIds = (text: string, hiddenLayerIds: LayerId[]): string[] => {
			return GraphQuery.search(multiLayerGraph, text, new Set(hiddenLayerIds)).map((graphNode) => graphNode.id);
		};
		expect(foundIds('PARSER', [])).toEqual(['issue:1', 'pull_request:3']);
		expect(foundIds('parser', ['issues'])).toEqual(['pull_request:3']);
		expect(foundIds('   ', [])).toEqual([]);
		expect(foundIds('no such text', [])).toEqual([]);
	});

	it('finds a node by identifier, or null', () => {
		const multiLayerGraph = SampleGraph.make();
		expect(GraphQuery.findNode(multiLayerGraph, 'commit:aaa')?.label).toBe('Commit: Merge pull request #3');
		expect(GraphQuery.findNode(multiLayerGraph, 'commit:zzz')).toBeNull();
	});
});
