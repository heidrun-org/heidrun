import 'bootstrap/dist/css/bootstrap.min.css';
import { MultiLayerGraphSchema, type LayerId, type MultiLayerGraph } from '../graph/multi_layer_graph_types.ts';
import { CytoscapeView, type LayoutName } from './cytoscape_view.ts';
import { GraphQuery } from './graph_query.ts';
import { LayerPanel } from './layer_panel.ts';
import { NodeCard } from './node_card.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MultiLayerGraphPage — the page of the experiment: loads graph.json and connects the view and the panels
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The page of the experiment. It loads the file graph.json, draws the 2D view, and connects the layer panel, the list
 * of layouts, the search field, the label under the pointer, and the information card.
 */
export class MultiLayerGraphPage {
	/** The multi-layer graph. */
	private _multiLayerGraph: MultiLayerGraph;
	/** The 2D view. */
	private _cytoscapeView: CytoscapeView;
	/** The information card of the selected node. */
	private _nodeCard: NodeCard;
	/** The layers that the developer hid. */
	private _hiddenLayerIds: ReadonlySet<LayerId> = new Set();

	/**
	 * Connects the page to a loaded graph.
	 * @param multiLayerGraph The multi-layer graph.
	 */
	private constructor(multiLayerGraph: MultiLayerGraph) {
		this._multiLayerGraph = multiLayerGraph;
		MultiLayerGraphPage._element('repository').textContent = multiLayerGraph.repository;
		this._cytoscapeView = new CytoscapeView(MultiLayerGraphPage._element('graph'), multiLayerGraph, {
			nodeClicked: (nodeId) => {
				this._select(nodeId);
			},
			nodeHovered: (nodeId, pageX, pageY) => {
				this._showHoverLabel(nodeId, pageX, pageY);
			},
		});
		this._nodeCard = new NodeCard(MultiLayerGraphPage._element('node-card'), {
			selectNode: (nodeId) => {
				this._select(nodeId);
			},
			close: () => {
				this._select(null);
			},
		});
		new LayerPanel(MultiLayerGraphPage._element('layer-panel'), multiLayerGraph, (hiddenLayerIds) => {
			this._hiddenLayerIds = hiddenLayerIds;
			this._cytoscapeView.setHiddenLayers(hiddenLayerIds);
			this._select(null);
		});
		this._setupLayoutSelect();
		this._setupSearch();
	}

	/**
	 * Loads the file graph.json, and starts the page.
	 * @returns A promise that resolves when the first layout has ended.
	 */
	static async start(): Promise<void> {
		const status = MultiLayerGraphPage._element('status');
		const response = await fetch('graph.json');
		if (response.ok === false) {
			status.textContent = 'The file graph.json does not exist. Run: pnpm --filter multi_layer_graph graph:build';
			return;
		}
		const multiLayerGraph = MultiLayerGraphSchema.parse(await response.json());
		const multiLayerGraphPage = new MultiLayerGraphPage(multiLayerGraph);
		await multiLayerGraphPage._runLayout('fcose');
	}

	/**
	 * Places the nodes with a layout, and shows a message while the layout runs.
	 * @param layoutName The layout.
	 * @returns A promise that resolves when the layout has ended.
	 */
	private async _runLayout(layoutName: LayoutName): Promise<void> {
		const status = MultiLayerGraphPage._element('status');
		const shownCount = this._multiLayerGraph.nodes
			.filter((graphNode) => GraphQuery.isShown(graphNode, this._hiddenLayerIds)).length;
		status.textContent = `Placing ${shownCount} nodes with the layout ${layoutName}…`;
		// Waits a short time, so that the browser shows the message before the layout blocks the page. A timer, and not
		// requestAnimationFrame, because a page in a background tab gets no frame and the layout would never start.
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 50);
		});
		const layoutTime = this._cytoscapeView.runLayout(layoutName);
		status.textContent = `${this._multiLayerGraph.nodes.length} nodes, ${this._multiLayerGraph.links.length} `
			+ `links. Layout ${layoutName}: ${(layoutTime / 1000).toFixed(1)} seconds.`;
	}

	/**
	 * Selects a node: the view shows it, and the information card shows its facts.
	 * @param nodeId The identifier of the node, or null to clear the selection.
	 */
	private _select(nodeId: string | null): void {
		const graphNode = nodeId === null ? null : GraphQuery.findNode(this._multiLayerGraph, nodeId);
		if (graphNode === null || GraphQuery.isShown(graphNode, this._hiddenLayerIds) === false) {
			this._cytoscapeView.select(null);
			this._nodeCard.hide();
			return;
		}
		const graphLayer = this._multiLayerGraph.layers.find(
			(candidateLayer) => candidateLayer.id === graphNode.layerId,
		);
		if (graphLayer === undefined) {
			return;
		}
		const linkedNodes = GraphQuery.neighbors(this._multiLayerGraph, graphNode.id)
			.filter((linkedNode) => GraphQuery.isShown(linkedNode, this._hiddenLayerIds));
		this._cytoscapeView.select(graphNode.id);
		this._nodeCard.show(graphNode, graphLayer, linkedNodes);
	}

	/**
	 * Shows the label of the node under the pointer, near the pointer.
	 * @param nodeId The identifier of the node, or null to hide the label.
	 * @param pageX The horizontal position of the pointer in the page.
	 * @param pageY The vertical position of the pointer in the page.
	 */
	private _showHoverLabel(nodeId: string | null, pageX: number, pageY: number): void {
		const hoverLabel = MultiLayerGraphPage._element('hover-label');
		const graphNode = nodeId === null ? null : GraphQuery.findNode(this._multiLayerGraph, nodeId);
		if (graphNode === null) {
			hoverLabel.classList.add('d-none');
			return;
		}
		hoverLabel.textContent = graphNode.label;
		hoverLabel.style.left = `${pageX + 12}px`;
		hoverLabel.style.top = `${pageY + 12}px`;
		hoverLabel.classList.remove('d-none');
	}

	/**
	 * Fills the list of layouts, and runs the chosen layout on each change.
	 */
	private _setupLayoutSelect(): void {
		const layoutSelect = MultiLayerGraphPage._element('layout-select') as HTMLSelectElement;
		for (const layoutName of CytoscapeView.LAYOUT_NAMES) {
			layoutSelect.add(new Option(layoutName, layoutName));
		}
		layoutSelect.addEventListener('change', () => {
			void this._runLayout(layoutSelect.value as LayoutName);
		});
	}

	/**
	 * Connects the search field: each change shows the number of nodes found, the key Enter selects the first node
	 * found, and the key Escape clears the field.
	 */
	private _setupSearch(): void {
		const searchField = MultiLayerGraphPage._element('search') as HTMLInputElement;
		const searchResult = MultiLayerGraphPage._element('search-result');
		searchField.addEventListener('input', () => {
			const graphNodes = GraphQuery.search(this._multiLayerGraph, searchField.value, this._hiddenLayerIds);
			searchResult.textContent = searchField.value.trim() === '' ? '' : `${graphNodes.length} nodes found.`;
		});
		searchField.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				searchField.value = '';
				searchResult.textContent = '';
				return;
			}
			if (event.key !== 'Enter') {
				return;
			}
			const graphNodes = GraphQuery.search(this._multiLayerGraph, searchField.value, this._hiddenLayerIds);
			if (graphNodes.length > 0) {
				this._select(graphNodes[0].id);
			}
		});
	}

	/**
	 * Finds an element of the page by identifier.
	 * @param elementId The identifier of the element.
	 * @returns The element.
	 */
	private static _element(elementId: string): HTMLElement {
		const element = document.getElementById(elementId);
		if (element === null) {
			throw new Error(`The page has no element with the identifier "${elementId}".`);
		}
		return element;
	}
}

void MultiLayerGraphPage.start();
