import type { LayerId, LinkKind } from '../graph/multi_layer_graph_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ViewerStyles — the colors and the shapes of the layers and of the links
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The look of the nodes of one layer.
 */
export type LayerStyle = {
	/** The color of the nodes, on the light surface of the page. */
	color: string;
	/** The shape of the nodes, as Cytoscape.js names it. The shape tells the layers apart without the color. */
	shape: 'ellipse' | 'diamond' | 'round-rectangle' | 'hexagon' | 'rectangle' | 'star' | 'triangle';
};

/**
 * The colors and the shapes of the layers and of the links. The colors of the layers are the categorical palette of
 * the dataviz skill, for the light surface, in its fixed order. The first three colors pass the check of all the pairs
 * on the light surface. The layers after the third one also have their own shape, so the shape tells them apart.
 */
export class ViewerStyles {
	/** The color of the surface of the page. */
	static readonly SURFACE_COLOR = '#fcfcfb';

	/** The color of the text of the labels. */
	static readonly LABEL_COLOR = '#52514e';

	/** The color of the border of the selected node. */
	static readonly SELECTED_COLOR = '#0b0b0b';

	/** The look of the nodes of each layer. */
	static readonly LAYER_STYLES: Record<LayerId, LayerStyle> = {
		issues: {
			color: '#2a78d6',
			shape: 'ellipse',
		},
		pull_requests: {
			color: '#eb6834',
			shape: 'diamond',
		},
		commits: {
			color: '#1baf7a',
			shape: 'round-rectangle',
		},
		chat_sessions: {
			color: '#eda100',
			shape: 'hexagon',
		},
		files: {
			color: '#e87ba4',
			shape: 'rectangle',
		},
		persons: {
			color: '#008300',
			shape: 'star',
		},
		user_activity_records: {
			color: '#4a3aa7',
			shape: 'triangle',
		},
	};

	/**
	 * The color of the links of each kind. A parent link is gray, because it is the most frequent kind. The links use
	 * the darker steps of the palette, because a thin line needs more contrast than a node.
	 */
	static readonly LINK_COLORS: Record<LinkKind, string> = {
		parent: '#898781',
		merge_commit: '#c98500',
		fixes: '#d55181',
		mentions: '#4a3aa7',
		chat_session_issue: '#2a78d6',
		chat_session_pull_request: '#eb6834',
		chat_session_file: '#d55181',
		author: '#008300',
		activity: '#4a3aa7',
	};

	/** The name of each kind of link, as the legend shows it. */
	static readonly LINK_NAMES: Record<LinkKind, string> = {
		parent: 'Parent commit',
		merge_commit: 'Merge commit',
		fixes: 'Fixes',
		mentions: 'Mentions',
		chat_session_issue: 'Chat session to issue',
		chat_session_pull_request: 'Chat session to pull request',
		chat_session_file: 'Chat session to file',
		author: 'Author',
		activity: 'Activity',
	};
}
