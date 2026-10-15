import type { LayerId, LinkKind, MultiLayerGraph } from '../graph/multi_layer_graph_types.ts';
import { HtmlEscape } from './html_escape.ts';
import { ShapeSwatch } from './shape_swatch.ts';
import { ViewerStyles } from './viewer_styles.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	LayerPanel — the list of the layers with a checkbox each, and the legend of the links
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The function that the layer panel calls each time the developer shows or hides a layer.
 */
export type LayerChangeFn = (hiddenLayerIds: ReadonlySet<LayerId>) => void;

/**
 * The layer panel: one row for each layer, with its shape, its color, its name, its number of nodes, and a checkbox
 * that shows or hides the layer. Under it, the legend of the kinds of links that the graph has.
 */
export class LayerPanel {
	/** The element that holds the layer panel. */
	private _element: HTMLElement;
	/** The layers that the developer hid. */
	private _hiddenLayerIds = new Set<LayerId>();

	/**
	 * Fills an element with the layer panel of a graph.
	 * @param element The element that holds the layer panel.
	 * @param multiLayerGraph The multi-layer graph.
	 * @param layerChangeFn The function to call each time a checkbox changes.
	 */
	constructor(element: HTMLElement, multiLayerGraph: MultiLayerGraph, layerChangeFn: LayerChangeFn) {
		this._element = element;
		this._element.innerHTML = LayerPanel.render(multiLayerGraph);
		this._element.addEventListener('change', (event) => {
			const target = event.target;
			if ((target instanceof HTMLInputElement) === false) {
				return;
			}
			const layerId = target.dataset.layerId as LayerId | undefined;
			if (layerId === undefined) {
				return;
			}
			if (target.checked === true) {
				this._hiddenLayerIds.delete(layerId);
			} else {
				this._hiddenLayerIds.add(layerId);
			}
			layerChangeFn(new Set(this._hiddenLayerIds));
		});
	}

	/**
	 * Makes the markup of the layer panel.
	 * @param multiLayerGraph The multi-layer graph.
	 * @returns The HTML markup.
	 */
	static render(multiLayerGraph: MultiLayerGraph): string {
		const layerRowsHtmlContent = multiLayerGraph.layers.map((graphLayer) => /* html */`
			<div class="d-flex align-items-center gap-2">
				<input class="check check-sm" type="checkbox" id="layer-${graphLayer.id}"
					data-layer-id="${graphLayer.id}" checked />
				<label for="layer-${graphLayer.id}" class="d-flex align-items-center gap-2 flex-fill text-sm">
					${ShapeSwatch.layer(graphLayer.id)}
					<span class="flex-fill">${HtmlEscape.text(graphLayer.name)}</span>
					<span class="fg-3">${graphLayer.nodeCount}</span>
				</label>
			</div>
		`).join('');
		const linkCounts = LayerPanel.linkCounts(multiLayerGraph);
		const linkRowsHtmlContent = [...linkCounts.entries()].map(([linkKind, linkCount]) => /* html */`
			<div class="d-flex align-items-center gap-2 text-sm">
				${ShapeSwatch.link(linkKind)}
				<span class="flex-fill">${HtmlEscape.text(ViewerStyles.LINK_NAMES[linkKind])}</span>
				<span class="fg-3">${linkCount}</span>
			</div>
		`).join('');
		const layerPanelHtmlContent = /* html */`
			<div class="vstack gap-1">
				<div class="text-sm fw-medium">Layers</div>
				${layerRowsHtmlContent}
				<div class="text-sm fw-medium mt-3">Links</div>
				${linkRowsHtmlContent}
			</div>
		`;
		return layerPanelHtmlContent;
	}

	/**
	 * Counts the links of each kind that the graph has, in the order of the first link of each kind.
	 * @param multiLayerGraph The multi-layer graph.
	 * @returns The number of links, by kind. A kind with no link is not in the map.
	 */
	static linkCounts(multiLayerGraph: MultiLayerGraph): Map<LinkKind, number> {
		const linkCounts = new Map<LinkKind, number>();
		for (const graphLink of multiLayerGraph.links) {
			linkCounts.set(graphLink.kind, (linkCounts.get(graphLink.kind) ?? 0) + 1);
		}
		return linkCounts;
	}
}
