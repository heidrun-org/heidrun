import Cytoscape from 'cytoscape';
import CytoscapeFcose from 'cytoscape-fcose';
import type { LayerId, MultiLayerGraph } from '../graph/multi_layer_graph_types.ts';
import { GraphQuery } from './graph_query.ts';
import { ViewerStyles } from './viewer_styles.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CytoscapeView — the 2D view of the multi-layer graph, drawn by Cytoscape.js as CodeSpine draws its graph
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

Cytoscape.use(CytoscapeFcose);

/**
 * The layouts that the developer can choose in the list of layouts.
 */
export type LayoutName = 'fcose' | 'concentric' | 'breadthfirst' | 'circle' | 'grid';

/**
 * The functions that the view calls on the actions of the developer.
 */
export type GraphViewEvents = {
	/** Called on a click on a node, with its identifier, or on the background, with null. */
	nodeClicked: (nodeId: string | null) => void;
	/** Called when the pointer goes over a node, with its position in the page, or leaves it, with null. */
	nodeHovered: (nodeId: string | null, pageX: number, pageY: number) => void;
};

/**
 * The 2D view of the multi-layer graph. It copies the rendering of CodeSpine: the layout fcose that includes the
 * labels, the size 8 + 4 × √degree, the color of the layer, Bézier links with an arrow in the color of their kind,
 * the labels below the nodes, and a zoom of the mouse wheel that is limited for each event.
 */
export class CytoscapeView {
	/** The names of the layouts, in the order of the list of layouts. */
	static readonly LAYOUT_NAMES: LayoutName[] = ['fcose', 'concentric', 'breadthfirst', 'circle', 'grid'];

	/**
	 * The largest change of zoom for one event of the mouse wheel, as a number of pixels. A trackpad sends small
	 * steps that stay under it, and one notch of a mouse wheel sends a large step that it limits. CodeSpine uses the
	 * same value.
	 */
	static readonly WHEEL_DELTA_CAP = 25;

	/** The Cytoscape.js graph. */
	private _cytoscape: Cytoscape.Core;

	/**
	 * Draws the graph in a container. The nodes have no position until `runLayout` runs.
	 * @param container The element that holds the view.
	 * @param multiLayerGraph The multi-layer graph.
	 * @param graphViewEvents The functions to call on the actions of the developer.
	 */
	constructor(container: HTMLElement, multiLayerGraph: MultiLayerGraph, graphViewEvents: GraphViewEvents) {
		const degrees = GraphQuery.degrees(multiLayerGraph);
		const elements: Cytoscape.ElementDefinition[] = [
			...multiLayerGraph.nodes.map((graphNode) => ({
				group: 'nodes' as const,
				data: {
					id: graphNode.id,
					label: graphNode.label,
					layerId: graphNode.layerId,
					degree: degrees.get(graphNode.id) ?? 0,
				},
			})),
			...multiLayerGraph.links.map((graphLink, linkIndex) => ({
				group: 'edges' as const,
				data: {
					id: `link:${linkIndex}`,
					source: graphLink.source,
					target: graphLink.target,
					kind: graphLink.kind,
				},
			})),
		];
		this._cytoscape = Cytoscape({
			container,
			elements,
			style: CytoscapeView._style(),
			layout: {
				name: 'preset',
			},
			userZoomingEnabled: false,
			boxSelectionEnabled: false,
			autounselectify: true,
		});
		this._cytoscape.on('tap', 'node', (event) => {
			graphViewEvents.nodeClicked(event.target.id());
		});
		this._cytoscape.on('tap', (event) => {
			if (event.target === this._cytoscape) {
				graphViewEvents.nodeClicked(null);
			}
		});
		this._cytoscape.on('mouseover', 'node', (event) => {
			const originalEvent = event.originalEvent as MouseEvent;
			graphViewEvents.nodeHovered(event.target.id(), originalEvent.pageX, originalEvent.pageY);
		});
		this._cytoscape.on('mouseout', 'node', () => {
			graphViewEvents.nodeHovered(null, 0, 0);
		});
		this._setupWheelZoom(container);
		const resizeObserver = new ResizeObserver(() => {
			this._cytoscape.resize();
		});
		resizeObserver.observe(container);
	}

	/**
	 * Places the nodes that show with a layout. The call blocks until the layout ends.
	 * @param layoutName The layout.
	 * @returns The time of the layout, in milliseconds.
	 */
	runLayout(layoutName: LayoutName): number {
		const startTime = performance.now();
		this._cytoscape.elements(':visible').layout(CytoscapeView._layoutOptions(layoutName)).run();
		this._cytoscape.fit(this._cytoscape.elements(':visible'), 30);
		return performance.now() - startTime;
	}

	/**
	 * Shows the nodes of every layer, except the hidden layers. A link to a hidden node is hidden too.
	 * @param hiddenLayerIds The layers to hide.
	 */
	setHiddenLayers(hiddenLayerIds: ReadonlySet<LayerId>): void {
		this._cytoscape.batch(() => {
			this._cytoscape.nodes().forEach((node) => {
				const isHidden = hiddenLayerIds.has(node.data('layerId') as LayerId);
				node.toggleClass('hidden-layer', isHidden);
			});
		});
	}

	/**
	 * Shows the selection: the selected node and its neighbors stay bright, and the other elements go dim. The view
	 * moves so that the selected node is at the center.
	 * @param nodeId The identifier of the selected node, or null to clear the selection.
	 */
	select(nodeId: string | null): void {
		this._cytoscape.batch(() => {
			this._cytoscape.elements().removeClass('faded selected-node');
			if (nodeId === null) {
				return;
			}
			const node = this._cytoscape.getElementById(nodeId);
			this._cytoscape.elements().not(node.closedNeighborhood()).addClass('faded');
			node.addClass('selected-node');
		});
		if (nodeId === null) {
			return;
		}
		this._cytoscape.animate({
			center: {
				eles: this._cytoscape.getElementById(nodeId),
			},
		}, {
			duration: 300,
		});
	}

	/**
	 * Removes the view and its listeners.
	 */
	destroy(): void {
		this._cytoscape.destroy();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Makes the style of the graph, as CodeSpine makes it.
	 * @returns The style of Cytoscape.js.
	 */
	private static _style(): Cytoscape.StylesheetJson {
		const nodeSize = (node: Cytoscape.NodeSingular): number => 8 + 4 * Math.sqrt(node.data('degree') as number);
		const nodeLayerId = (node: Cytoscape.NodeSingular): LayerId => node.data('layerId') as LayerId;
		const linkColor = (edge: Cytoscape.EdgeSingular): string => {
			return ViewerStyles.LINK_COLORS[edge.data('kind') as keyof typeof ViewerStyles.LINK_COLORS];
		};
		const style: Cytoscape.StylesheetJson = [
			{
				selector: 'node',
				style: {
					'background-color': (node: Cytoscape.NodeSingular) => {
						return ViewerStyles.LAYER_STYLES[nodeLayerId(node)].color;
					},
					'shape': (node: Cytoscape.NodeSingular) => ViewerStyles.LAYER_STYLES[nodeLayerId(node)].shape,
					'width': nodeSize,
					'height': nodeSize,
					'border-width': 0,
					'label': 'data(label)',
					'color': ViewerStyles.LABEL_COLOR,
					'font-size': 8,
					'min-zoomed-font-size': 7,
					'text-valign': 'bottom',
					'text-margin-y': 3,
					'text-wrap': 'ellipsis',
					'text-max-width': '160px',
					'text-background-color': ViewerStyles.SURFACE_COLOR,
					'text-background-opacity': 0.5,
					'text-background-shape': 'roundrectangle',
					'text-background-padding': '2px',
				},
			},
			{
				selector: 'edge',
				style: {
					'width': 1,
					'line-color': linkColor,
					'target-arrow-color': linkColor,
					'target-arrow-shape': 'triangle',
					'arrow-scale': 0.6,
					'curve-style': 'bezier',
					'opacity': 0.65,
				},
			},
			{
				selector: '.hidden-layer',
				style: {
					display: 'none',
				},
			},
			{
				selector: '.faded',
				style: {
					'opacity': 0.25,
					'text-opacity': 0,
					'text-background-opacity': 0,
				},
			},
			{
				selector: 'node.selected-node',
				style: {
					'border-width': 3,
					'border-color': ViewerStyles.SELECTED_COLOR,
					'border-style': 'solid',
				},
			},
		];
		return style;
	}

	/**
	 * Makes the options of a layout, as CodeSpine makes them.
	 * @param layoutName The layout.
	 * @returns The options of the layout.
	 */
	private static _layoutOptions(layoutName: LayoutName): Cytoscape.LayoutOptions {
		const baseOptions = {
			animate: false,
			padding: 30,
		};
		if (layoutName === 'fcose') {
			return {
				...baseOptions,
				name: 'fcose',
				nodeDimensionsIncludeLabels: true,
			} as Cytoscape.LayoutOptions;
		}
		if (layoutName === 'concentric') {
			return {
				...baseOptions,
				name: 'concentric',
				concentric: (node: Cytoscape.NodeSingular) => node.degree(false),
				levelWidth: () => 2,
			};
		}
		return {
			...baseOptions,
			name: layoutName,
		};
	}

	/**
	 * Zooms on the mouse wheel, with the step of each event limited to `WHEEL_DELTA_CAP`, in place of the zoom of
	 * Cytoscape.js. The zoom keeps the point under the pointer in place.
	 * @param container The element that holds the view.
	 */
	private _setupWheelZoom(container: HTMLElement): void {
		container.addEventListener('wheel', (event) => {
			event.preventDefault();
			let delta = event.deltaY;
			if (event.deltaMode === 1) {
				delta *= 16;
			} else if (event.deltaMode === 2) {
				delta *= container.clientHeight;
			}
			const deltaCap = CytoscapeView.WHEEL_DELTA_CAP;
			const cappedDelta = Math.max(-deltaCap, Math.min(deltaCap, delta));
			const rect = container.getBoundingClientRect();
			this._cytoscape.zoom({
				level: this._cytoscape.zoom() * Math.pow(10, cappedDelta / -250),
				renderedPosition: {
					x: event.clientX - rect.left,
					y: event.clientY - rect.top,
				},
			});
		}, {
			passive: false,
		});
	}
}
