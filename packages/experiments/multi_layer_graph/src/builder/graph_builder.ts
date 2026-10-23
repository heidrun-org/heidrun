import type {
	GraphFact,
	GraphLayer,
	GraphLink,
	GraphNode,
	LayerId,
	LinkKind,
	MultiLayerGraph,
} from '../graph/multi_layer_graph_types.ts';
import type { CommitRow, IssueRow, PullRequestRow } from './data_layer_row_types.ts';
import { ReferenceParser } from './reference_parser.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GraphBuilder — turns the rows of the data layer packages into the multi-layer graph
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The rows that the builder turns into the multi-layer graph.
 */
export type GraphBuilderInput = {
	/** The repository, in the format "owner/name". */
	repository: string;
	/** The date and time of the build, in ISO 8601 format. */
	builtAt: string;
	/** The issues of the repository. */
	issueRows: IssueRow[];
	/** The pull requests of the repository. */
	pullRequestRows: PullRequestRow[];
	/** The commits of the repository, merges included. */
	commitRows: CommitRow[];
};

/**
 * Turns the rows of the data layer packages into the multi-layer graph. It reads no file and writes no file. A link
 * joins two nodes that exist, never a node to itself, and a pair of nodes gets one link at most: the first one added.
 */
export class GraphBuilder {
	/** The name of each layer, as the layer panel shows it. */
	private static readonly _LAYER_NAMES: Record<LayerId, string> = {
		issues: 'Issues',
		pull_requests: 'Pull requests',
		commits: 'Commits',
		chat_sessions: 'Chat sessions',
		files: 'Files',
		persons: 'Persons',
		user_activity_records: 'User activity records',
	};

	/** The repository, in the format "owner/name". */
	private _repository: string;
	/** The layers that the builder fills, in the order of the layer panel. */
	private _layerIds: LayerId[] = [];
	/** The nodes, by identifier. */
	private _nodes = new Map<string, GraphNode>();
	/** The links, in the order in which they were added. */
	private _links: GraphLink[] = [];
	/** The pairs of nodes that already have a link, as "a|b" with a before b. */
	private _linkedPairs = new Set<string>();

	/**
	 * Creates an empty builder.
	 * @param repository The repository, in the format "owner/name".
	 */
	private constructor(repository: string) {
		this._repository = repository;
	}

	/**
	 * Builds the multi-layer graph.
	 * @param graphBuilderInput The rows of the data layer packages.
	 * @returns The multi-layer graph.
	 */
	static build(graphBuilderInput: GraphBuilderInput): MultiLayerGraph {
		const builder = new GraphBuilder(graphBuilderInput.repository);
		builder._addIssueNodes(graphBuilderInput.issueRows);
		builder._addPullRequestNodes(graphBuilderInput.pullRequestRows);
		builder._addCommitNodes(graphBuilderInput.commitRows);
		builder._addParentLinks(graphBuilderInput.commitRows);
		builder._addMergeCommitLinks(graphBuilderInput.pullRequestRows);
		builder._addFixesLinks(graphBuilderInput.pullRequestRows);
		builder._addCommitMentionsLinks(graphBuilderInput.commitRows);
		builder._addIssueMentionsLinks(graphBuilderInput.issueRows);
		const multiLayerGraph = builder._toGraph(graphBuilderInput.builtAt);
		return multiLayerGraph;
	}

	/**
	 * The identifier of the node of an issue.
	 * @param number The number of the issue.
	 * @returns The identifier.
	 */
	static issueNodeId(number: number): string {
		return `issue:${number}`;
	}

	/**
	 * The identifier of the node of a pull request.
	 * @param number The number of the pull request.
	 * @returns The identifier.
	 */
	static pullRequestNodeId(number: number): string {
		return `pull_request:${number}`;
	}

	/**
	 * The identifier of the node of a commit.
	 * @param hash The hash of the commit.
	 * @returns The identifier.
	 */
	static commitNodeId(hash: string): string {
		return `commit:${hash}`;
	}

	/**
	 * Writes a date of the data layer packages as text, for an information card.
	 * @param isoDate The date, in ISO 8601 format, or null.
	 * @returns The date as text, for example "15 October 2026 at 14:31 UTC", or "None".
	 */
	static formatDate(isoDate: string | null): string {
		if (isoDate === null) {
			return 'None';
		}
		const date = new Date(isoDate);
		if (Number.isNaN(date.getTime()) === true) {
			return isoDate;
		}
		const dateFormat = new Intl.DateTimeFormat('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'UTC',
		});
		return `${dateFormat.format(date)} UTC`;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Nodes
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Adds one node for each issue.
	 * @param issueRows The issues.
	 */
	private _addIssueNodes(issueRows: IssueRow[]): void {
		this._layerIds.push('issues');
		for (const issueRow of issueRows) {
			this._addNode({
				id: GraphBuilder.issueNodeId(issueRow.number),
				layerId: 'issues',
				label: `Issue ${issueRow.number}: ${issueRow.title}`,
				url: `https://github.com/${this._repository}/issues/${issueRow.number}`,
				facts: [
					GraphBuilder._fact('State', issueRow.state),
					GraphBuilder._fact('Author', issueRow.author ?? 'Unknown'),
					GraphBuilder._fact('Created', GraphBuilder.formatDate(issueRow.createdAt)),
					GraphBuilder._fact('Closed', GraphBuilder.formatDate(issueRow.closedAt)),
					GraphBuilder._fact('Labels', issueRow.labels.length > 0 ? issueRow.labels.join(', ') : 'None'),
					GraphBuilder._fact('Comments', String(issueRow.commentCount)),
				],
			});
		}
	}

	/**
	 * Adds one node for each pull request.
	 * @param pullRequestRows The pull requests.
	 */
	private _addPullRequestNodes(pullRequestRows: PullRequestRow[]): void {
		this._layerIds.push('pull_requests');
		for (const pullRequestRow of pullRequestRows) {
			this._addNode({
				id: GraphBuilder.pullRequestNodeId(pullRequestRow.number),
				layerId: 'pull_requests',
				label: `Pull request ${pullRequestRow.number}: ${pullRequestRow.title}`,
				url: `https://github.com/${this._repository}/pull/${pullRequestRow.number}`,
				facts: [
					GraphBuilder._fact('State', pullRequestRow.state),
					GraphBuilder._fact('Author', pullRequestRow.author ?? 'Unknown'),
					GraphBuilder._fact('Branch', `${pullRequestRow.headRefName} into ${pullRequestRow.baseRefName}`),
					GraphBuilder._fact('Created', GraphBuilder.formatDate(pullRequestRow.createdAt)),
					GraphBuilder._fact('Merged', GraphBuilder.formatDate(pullRequestRow.mergedAt)),
					GraphBuilder._fact('Commits', String(pullRequestRow.commitCount)),
					GraphBuilder._fact('Files changed', String(pullRequestRow.changedFiles)),
					GraphBuilder._fact('Lines added', String(pullRequestRow.additions)),
					GraphBuilder._fact('Lines deleted', String(pullRequestRow.deletions)),
				],
			});
		}
	}

	/**
	 * Adds one node for each commit, merges included.
	 * @param commitRows The commits.
	 */
	private _addCommitNodes(commitRows: CommitRow[]): void {
		this._layerIds.push('commits');
		for (const commitRow of commitRows) {
			this._addNode({
				id: GraphBuilder.commitNodeId(commitRow.hash),
				layerId: 'commits',
				label: `Commit: ${commitRow.subject}`,
				url: `https://github.com/${this._repository}/commit/${commitRow.hash}`,
				facts: [
					GraphBuilder._fact('Hash', commitRow.hash),
					GraphBuilder._fact('Author', commitRow.authorName),
					GraphBuilder._fact('Committed', GraphBuilder.formatDate(commitRow.committedAt)),
					GraphBuilder._fact('Parents', String(commitRow.parents.length)),
					GraphBuilder._fact('Files changed', String(commitRow.filesChanged)),
					GraphBuilder._fact('Lines added', String(commitRow.insertions)),
					GraphBuilder._fact('Lines deleted', String(commitRow.deletions)),
				],
			});
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Links
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Adds a link from each commit to each of its parents.
	 * @param commitRows The commits.
	 */
	private _addParentLinks(commitRows: CommitRow[]): void {
		for (const commitRow of commitRows) {
			for (const parentHash of commitRow.parents) {
				this._addLink(
					GraphBuilder.commitNodeId(commitRow.hash),
					GraphBuilder.commitNodeId(parentHash),
					'parent',
				);
			}
		}
	}

	/**
	 * Adds a link from each merged pull request to its merge commit.
	 * @param pullRequestRows The pull requests.
	 */
	private _addMergeCommitLinks(pullRequestRows: PullRequestRow[]): void {
		for (const pullRequestRow of pullRequestRows) {
			if (pullRequestRow.mergeCommit === null) {
				continue;
			}
			this._addLink(
				GraphBuilder.pullRequestNodeId(pullRequestRow.number),
				GraphBuilder.commitNodeId(pullRequestRow.mergeCommit),
				'merge_commit',
			);
		}
	}

	/**
	 * Adds a link from each pull request to each issue that its title or its text fixes.
	 * @param pullRequestRows The pull requests.
	 */
	private _addFixesLinks(pullRequestRows: PullRequestRow[]): void {
		for (const pullRequestRow of pullRequestRows) {
			const text = `${pullRequestRow.title}\n${pullRequestRow.body}`;
			for (const number of ReferenceParser.findFixedNumbers(text, this._repository)) {
				this._addLink(
					GraphBuilder.pullRequestNodeId(pullRequestRow.number),
					GraphBuilder.issueNodeId(number),
					'fixes',
				);
			}
		}
	}

	/**
	 * Adds a link from each commit to each issue or pull request that its message names.
	 * @param commitRows The commits.
	 */
	private _addCommitMentionsLinks(commitRows: CommitRow[]): void {
		for (const commitRow of commitRows) {
			const text = `${commitRow.subject}\n${commitRow.body}`;
			for (const number of ReferenceParser.findMentionedNumbers(text, this._repository)) {
				this._addNumberLink(GraphBuilder.commitNodeId(commitRow.hash), number, 'mentions');
			}
		}
	}

	/**
	 * Adds a link from each issue to each issue or pull request that its text names.
	 * @param issueRows The issues.
	 */
	private _addIssueMentionsLinks(issueRows: IssueRow[]): void {
		for (const issueRow of issueRows) {
			for (const number of ReferenceParser.findMentionedNumbers(issueRow.body, this._repository)) {
				this._addNumberLink(GraphBuilder.issueNodeId(issueRow.number), number, 'mentions');
			}
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Makes one fact of an information card.
	 * @param name The name of the fact.
	 * @param value The value of the fact.
	 * @returns The fact.
	 */
	private static _fact(name: string, value: string): GraphFact {
		return {
			name,
			value,
		};
	}

	/**
	 * Adds a node, when no node has its identifier yet.
	 * @param graphNode The node.
	 */
	private _addNode(graphNode: GraphNode): void {
		if (this._nodes.has(graphNode.id) === true) {
			return;
		}
		this._nodes.set(graphNode.id, graphNode);
	}

	/**
	 * Adds a link to the issue of a number, or else to the pull request of the number. GitHub never gives one number
	 * to both.
	 * @param sourceId The identifier of the node where the link starts.
	 * @param number The number of the issue or of the pull request.
	 * @param kind The kind of the link.
	 */
	private _addNumberLink(sourceId: string, number: number, kind: LinkKind): void {
		const issueNodeId = GraphBuilder.issueNodeId(number);
		const targetId = this._nodes.has(issueNodeId) === true ? issueNodeId : GraphBuilder.pullRequestNodeId(number);
		this._addLink(sourceId, targetId, kind);
	}

	/**
	 * Adds a link, when its two nodes exist, are two different nodes, and have no link yet.
	 * @param sourceId The identifier of the node where the link starts.
	 * @param targetId The identifier of the node where the link ends.
	 * @param kind The kind of the link.
	 */
	private _addLink(sourceId: string, targetId: string, kind: LinkKind): void {
		if (sourceId === targetId) {
			return;
		}
		if (this._nodes.has(sourceId) === false || this._nodes.has(targetId) === false) {
			return;
		}
		const pairKey = sourceId < targetId ? `${sourceId}|${targetId}` : `${targetId}|${sourceId}`;
		if (this._linkedPairs.has(pairKey) === true) {
			return;
		}
		this._linkedPairs.add(pairKey);
		this._links.push({
			source: sourceId,
			target: targetId,
			kind,
		});
	}

	/**
	 * Makes the multi-layer graph from the nodes and the links.
	 * @param builtAt The date and time of the build, in ISO 8601 format.
	 * @returns The multi-layer graph.
	 */
	private _toGraph(builtAt: string): MultiLayerGraph {
		const graphNodes = [...this._nodes.values()];
		const graphLayers: GraphLayer[] = this._layerIds.map((layerId) => ({
			id: layerId,
			name: GraphBuilder._LAYER_NAMES[layerId],
			nodeCount: graphNodes.filter((graphNode) => graphNode.layerId === layerId).length,
		}));
		const multiLayerGraph: MultiLayerGraph = {
			repository: this._repository,
			builtAt,
			layers: graphLayers,
			nodes: graphNodes,
			links: this._links,
		};
		return multiLayerGraph;
	}
}
