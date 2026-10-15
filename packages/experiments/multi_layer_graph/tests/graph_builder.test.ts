import { describe, expect, it } from 'vitest';
import { GraphBuilder, type GraphBuilderInput } from '../src/builder/graph_builder.ts';
import { MultiLayerGraphSchema } from '../src/graph/multi_layer_graph_types.ts';
import { TestDatabase } from './test_database.ts';

const REPOSITORY = 'heidrun-org/heidrun';

/**
 * Makes the input of the builder for a test.
 */
class BuilderInput {
	/**
	 * Makes the input of the builder, with no row unless the test gives rows.
	 * @param partialInput The rows of the test.
	 * @returns The input of the builder.
	 */
	static make(partialInput: Partial<GraphBuilderInput>): GraphBuilderInput {
		return {
			repository: REPOSITORY,
			builtAt: '2026-10-15T12:00:00.000Z',
			issueRows: [],
			pullRequestRows: [],
			commitRows: [],
			...partialInput,
		};
	}
}

describe('GraphBuilder.build', () => {
	it('makes the three layers of the stage 1, with one node for each row', () => {
		const multiLayerGraph = GraphBuilder.build(BuilderInput.make({
			issueRows: [TestDatabase.issueRow(1, 'First issue', '')],
			pullRequestRows: [TestDatabase.pullRequestRow(2, 'First pull request', '', null)],
			commitRows: [TestDatabase.commitRow('aaa', [], 'First commit', '')],
		}));
		expect(MultiLayerGraphSchema.parse(multiLayerGraph)).toEqual(multiLayerGraph);
		expect(multiLayerGraph.layers).toEqual([
			{
				id: 'issues',
				name: 'Issues',
				nodeCount: 1,
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
		]);
		expect(multiLayerGraph.nodes.map((graphNode) => [graphNode.id, graphNode.label, graphNode.url])).toEqual([
			['issue:1', 'Issue 1: First issue', 'https://github.com/heidrun-org/heidrun/issues/1'],
			['pull_request:2', 'Pull request 2: First pull request', 'https://github.com/heidrun-org/heidrun/pull/2'],
			['commit:aaa', 'Commit: First commit', 'https://github.com/heidrun-org/heidrun/commit/aaa'],
		]);
	});

	it('links each commit to its parents that exist', () => {
		const multiLayerGraph = GraphBuilder.build(BuilderInput.make({
			commitRows: [
				TestDatabase.commitRow('aaa', [], 'Root', ''),
				TestDatabase.commitRow('bbb', ['aaa', 'not-in-the-table'], 'Child', ''),
			],
		}));
		expect(multiLayerGraph.links).toEqual([
			{
				source: 'commit:bbb',
				target: 'commit:aaa',
				kind: 'parent',
			},
		]);
	});

	it('links a pull request to its merge commit and to the issue that it fixes', () => {
		const multiLayerGraph = GraphBuilder.build(BuilderInput.make({
			issueRows: [TestDatabase.issueRow(1, 'The bug', '')],
			pullRequestRows: [TestDatabase.pullRequestRow(2, 'The fix', 'Fixes #1', 'ccc')],
			commitRows: [TestDatabase.commitRow('ccc', [], 'Merge pull request #2 from heidrun-org/the-fix', '')],
		}));
		expect(multiLayerGraph.links).toEqual([
			{
				source: 'pull_request:2',
				target: 'commit:ccc',
				kind: 'merge_commit',
			},
			{
				source: 'pull_request:2',
				target: 'issue:1',
				kind: 'fixes',
			},
		]);
	});

	it('links a commit and an issue to the issue or to the pull request of each number that they name', () => {
		const multiLayerGraph = GraphBuilder.build(BuilderInput.make({
			issueRows: [
				TestDatabase.issueRow(1, 'The parent issue', 'See #3, #4, and #99'),
				TestDatabase.issueRow(3, 'A sub-issue', 'Part of #1, and #3 is this issue'),
			],
			pullRequestRows: [TestDatabase.pullRequestRow(4, 'A pull request', '', null)],
			commitRows: [TestDatabase.commitRow('aaa', [], 'Change the parser, fixes #3', 'See #4')],
		}));
		expect(multiLayerGraph.links).toEqual([
			{
				source: 'commit:aaa',
				target: 'issue:3',
				kind: 'mentions',
			},
			{
				source: 'commit:aaa',
				target: 'pull_request:4',
				kind: 'mentions',
			},
			{
				source: 'issue:1',
				target: 'issue:3',
				kind: 'mentions',
			},
			{
				source: 'issue:1',
				target: 'pull_request:4',
				kind: 'mentions',
			},
		]);
	});

	it('writes the facts of the information card, with the dates as text', () => {
		const multiLayerGraph = GraphBuilder.build(BuilderInput.make({
			issueRows: [TestDatabase.issueRow(1, 'The bug', '')],
		}));
		expect(multiLayerGraph.nodes[0].facts).toEqual([
			{
				name: 'State',
				value: 'OPEN',
			},
			{
				name: 'Author',
				value: 'jeromeetienne',
			},
			{
				name: 'Created',
				value: '1 October 2026 at 10:00 UTC',
			},
			{
				name: 'Closed',
				value: 'None',
			},
			{
				name: 'Labels',
				value: 'None',
			},
			{
				name: 'Comments',
				value: '0',
			},
		]);
	});
});
