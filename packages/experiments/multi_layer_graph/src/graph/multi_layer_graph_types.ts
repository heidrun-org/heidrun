import { z } from 'zod';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MultiLayerGraphTypes — the shape of the file graph.json
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The identifier of a layer. Each layer holds one kind of node.
 */
export const LayerIdSchema = z.enum([
	'issues',
	'pull_requests',
	'commits',
	'chat_sessions',
	'files',
	'persons',
	'user_activity_records',
]);

/**
 * The identifier of a layer. Each layer holds one kind of node.
 */
export type LayerId = z.infer<typeof LayerIdSchema>;

/**
 * The kind of a link: the fact of the data layer packages that joins its two nodes.
 */
export const LinkKindSchema = z.enum([
	'parent',
	'merge_commit',
	'fixes',
	'mentions',
	'chat_session_issue',
	'chat_session_pull_request',
	'chat_session_file',
	'author',
	'activity',
]);

/**
 * The kind of a link: the fact of the data layer packages that joins its two nodes.
 */
export type LinkKind = z.infer<typeof LinkKindSchema>;

/**
 * One line of the information card of a node: a name and its value, as text.
 */
export const GraphFactSchema = z.object({
	/** The name of the fact, for example "Author". */
	name: z.string(),
	/** The value of the fact, as text. */
	value: z.string(),
});

/**
 * One line of the information card of a node: a name and its value, as text.
 */
export type GraphFact = z.infer<typeof GraphFactSchema>;

/**
 * One layer of the multi-layer graph.
 */
export const GraphLayerSchema = z.object({
	/** The identifier of the layer. */
	id: LayerIdSchema,
	/** The name of the layer, as the layer panel shows it. */
	name: z.string(),
	/** The number of nodes of the layer. */
	nodeCount: z.number().int().nonnegative(),
});

/**
 * One layer of the multi-layer graph.
 */
export type GraphLayer = z.infer<typeof GraphLayerSchema>;

/**
 * One node of the multi-layer graph: one issue, one pull request, one commit, and so on.
 */
export const GraphNodeSchema = z.object({
	/** The identifier of the node, unique in the graph, for example "issue:510". */
	id: z.string(),
	/** The layer that holds the node. */
	layerId: LayerIdSchema,
	/** The text that the pointer shows over the node, and that the search reads. */
	label: z.string(),
	/** The address of the node on GitHub, or null when the node has no page. */
	url: z.string().nullable(),
	/** The facts that the information card shows. */
	facts: z.array(GraphFactSchema),
});

/**
 * One node of the multi-layer graph: one issue, one pull request, one commit, and so on.
 */
export type GraphNode = z.infer<typeof GraphNodeSchema>;

/**
 * One link of the multi-layer graph. It joins two nodes of one layer, or two nodes of two different layers.
 */
export const GraphLinkSchema = z.object({
	/** The identifier of the node where the link starts. */
	source: z.string(),
	/** The identifier of the node where the link ends. */
	target: z.string(),
	/** The kind of the link. */
	kind: LinkKindSchema,
});

/**
 * One link of the multi-layer graph. It joins two nodes of one layer, or two nodes of two different layers.
 */
export type GraphLink = z.infer<typeof GraphLinkSchema>;

/**
 * The multi-layer graph of one repository: the content of the file graph.json.
 */
export const MultiLayerGraphSchema = z.object({
	/** The repository, in the format "owner/name". */
	repository: z.string(),
	/** The date and time when the command line wrote the graph, in ISO 8601 format. */
	builtAt: z.string(),
	/** The layers, in the order of the layer panel. */
	layers: z.array(GraphLayerSchema),
	/** The nodes of all the layers. */
	nodes: z.array(GraphNodeSchema),
	/** The links. Each link joins two nodes of the list `nodes`, and a pair of nodes has one link at most. */
	links: z.array(GraphLinkSchema),
});

/**
 * The multi-layer graph of one repository: the content of the file graph.json.
 */
export type MultiLayerGraph = z.infer<typeof MultiLayerGraphSchema>;
