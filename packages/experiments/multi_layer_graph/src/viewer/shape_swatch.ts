import type { LayerId, LinkKind } from '../graph/multi_layer_graph_types.ts';
import { ViewerStyles, type LayerStyle } from './viewer_styles.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ShapeSwatch — the small pictures of a layer and of a kind of link, for the legend and the card
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Makes the small SVG pictures that the legend and the information card show: the shape and the color of the nodes
 * of a layer, and the line of a kind of link.
 */
export class ShapeSwatch {
	/** The points of each shape that is a polygon, in a box of 12 × 12. */
	private static readonly _POLYGON_POINTS: Partial<Record<LayerStyle['shape'], string>> = {
		diamond: '6,0.5 11.5,6 6,11.5 0.5,6',
		hexagon: '3,0.8 9,0.8 11.7,6 9,11.2 3,11.2 0.3,6',
		star: '6,0.3 7.6,4.2 11.7,4.4 8.5,7 9.6,11.2 6,8.8 2.4,11.2 3.5,7 0.3,4.4 4.4,4.2',
		triangle: '6,0.5 11.5,11.2 0.5,11.2',
	};

	/**
	 * Makes the picture of the nodes of a layer.
	 * @param layerId The layer.
	 * @returns The SVG markup.
	 */
	static layer(layerId: LayerId): string {
		const layerStyle = ViewerStyles.LAYER_STYLES[layerId];
		const shapeHtmlContent = ShapeSwatch._shape(layerStyle);
		const svgHtmlContent = /* html */`
			<svg class="flex-shrink-0" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
				${shapeHtmlContent}
			</svg>
		`;
		return svgHtmlContent;
	}

	/**
	 * Makes the picture of the links of a kind.
	 * @param linkKind The kind of the links.
	 * @returns The SVG markup.
	 */
	static link(linkKind: LinkKind): string {
		const color = ViewerStyles.LINK_COLORS[linkKind];
		const svgHtmlContent = /* html */`
			<svg class="flex-shrink-0" width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
				<line x1="1" y1="6" x2="11" y2="6" stroke="${color}" stroke-width="2" />
				<polygon points="11,3 15,6 11,9" fill="${color}" />
			</svg>
		`;
		return svgHtmlContent;
	}

	/**
	 * Makes the SVG element of the shape of a layer.
	 * @param layerStyle The look of the layer.
	 * @returns The SVG markup of one element.
	 */
	private static _shape(layerStyle: LayerStyle): string {
		const polygonPoints = ShapeSwatch._POLYGON_POINTS[layerStyle.shape];
		if (polygonPoints !== undefined) {
			return `<polygon points="${polygonPoints}" fill="${layerStyle.color}" />`;
		}
		if (layerStyle.shape === 'ellipse') {
			return `<circle cx="6" cy="6" r="5.5" fill="${layerStyle.color}" />`;
		}
		const cornerRadius = layerStyle.shape === 'round-rectangle' ? 3 : 0;
		return `<rect x="0.5" y="0.5" width="11" height="11" rx="${cornerRadius}" fill="${layerStyle.color}" />`;
	}
}
