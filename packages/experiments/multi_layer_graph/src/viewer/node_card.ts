import type { GraphLayer, GraphNode } from '../graph/multi_layer_graph_types.ts';
import { HtmlEscape } from './html_escape.ts';
import { ShapeSwatch } from './shape_swatch.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NodeCard — the information card of the selected node
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The functions that the information card calls on a click.
 */
export type NodeCardActions = {
	/** Called when the developer clicks a linked node: the page selects it. */
	selectNode: (nodeId: string) => void;
	/** Called when the developer closes the information card: the page clears the selection. */
	close: () => void;
};

/**
 * The information card of the selected node: its layer, its label, its facts, a link that opens it on GitHub, and the
 * list of its linked nodes. A click on a linked node selects it, so the developer can walk the graph.
 */
export class NodeCard {
	/** The largest number of linked nodes that the card lists. */
	static readonly MAX_LINKED_NODES = 100;

	/** The element that holds the information card. */
	private _element: HTMLElement;

	/**
	 * Connects the information card to its element.
	 * @param element The element that holds the information card.
	 * @param nodeCardActions The functions to call on a click.
	 */
	constructor(element: HTMLElement, nodeCardActions: NodeCardActions) {
		this._element = element;
		this._element.addEventListener('click', (event) => {
			const target = event.target;
			if ((target instanceof Element) === false) {
				return;
			}
			const actionElement = target.closest<HTMLElement>('[data-action]');
			if (actionElement === null) {
				return;
			}
			if (actionElement.dataset.action === 'close') {
				nodeCardActions.close();
				return;
			}
			const nodeId = actionElement.dataset.nodeId;
			if (actionElement.dataset.action === 'select' && nodeId !== undefined) {
				nodeCardActions.selectNode(nodeId);
			}
		});
	}

	/**
	 * Shows the information card of a node.
	 * @param graphNode The node.
	 * @param graphLayer The layer of the node.
	 * @param linkedNodes The nodes that one link joins to the node.
	 */
	show(graphNode: GraphNode, graphLayer: GraphLayer, linkedNodes: GraphNode[]): void {
		this._element.innerHTML = NodeCard.render(graphNode, graphLayer, linkedNodes);
		this._element.classList.remove('d-none');
	}

	/**
	 * Hides the information card.
	 */
	hide(): void {
		this._element.classList.add('d-none');
		this._element.innerHTML = '';
	}

	/**
	 * Makes the markup of the information card of a node.
	 * @param graphNode The node.
	 * @param graphLayer The layer of the node.
	 * @param linkedNodes The nodes that one link joins to the node.
	 * @returns The HTML markup.
	 */
	static render(graphNode: GraphNode, graphLayer: GraphLayer, linkedNodes: GraphNode[]): string {
		const factsHtmlContent = graphNode.facts.map((graphFact) => /* html */`
			<dt class="col-5 fw-normal fg-3">${HtmlEscape.text(graphFact.name)}</dt>
			<dd class="col-7 mb-1 text-break">${HtmlEscape.text(graphFact.value)}</dd>
		`).join('');
		const openHtmlContent = graphNode.url === null ? '' : /* html */`
			<a class="btn btn-sm btn-subtle theme-secondary" href="${HtmlEscape.text(graphNode.url)}" target="_blank"
				rel="noopener noreferrer">Open on GitHub</a>
		`;
		const shownNodes = linkedNodes.slice(0, NodeCard.MAX_LINKED_NODES);
		const linkedNodesHtmlContent = shownNodes.map((linkedNode) => /* html */`
			<button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2"
				data-action="select" data-node-id="${HtmlEscape.text(linkedNode.id)}"
				title="${HtmlEscape.text(linkedNode.label)}">
				${ShapeSwatch.layer(linkedNode.layerId)}
				<span class="text-truncate">${HtmlEscape.text(linkedNode.label)}</span>
			</button>
		`).join('');
		const hiddenCount = linkedNodes.length - shownNodes.length;
		const moreHtmlContent = hiddenCount === 0 ? '' : /* html */`
			<div class="text-xs fg-3">And ${hiddenCount} more linked nodes.</div>
		`;
		const nodeCardHtmlContent = /* html */`
			<div class="card-body vstack gap-2">
				<div class="d-flex align-items-start gap-2">
					<div class="pt-1">${ShapeSwatch.layer(graphNode.layerId)}</div>
					<div class="flex-fill min-w-0">
						<div class="text-xs fg-3">${HtmlEscape.text(graphLayer.name)}</div>
						<div class="fw-medium text-break">${HtmlEscape.text(graphNode.label)}</div>
					</div>
					<button type="button" class="btn-close" aria-label="Close the information card"
						data-action="close"></button>
				</div>
				<dl class="row text-sm mb-0">
					${factsHtmlContent}
				</dl>
				${openHtmlContent}
				<div class="text-sm fw-medium">Linked nodes: ${linkedNodes.length}</div>
				<div class="list-group list-group-flush text-sm">
					${linkedNodesHtmlContent}
				</div>
				${moreHtmlContent}
			</div>
		`;
		return nodeCardHtmlContent;
	}
}
