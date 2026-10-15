import { describe, expect, it } from 'vitest';
import { HtmlEscape } from '../src/viewer/html_escape.ts';
import { LayerPanel } from '../src/viewer/layer_panel.ts';
import { NodeCard } from '../src/viewer/node_card.ts';
import { SampleGraph } from './sample_graph.ts';

describe('HtmlEscape', () => {
	it('escapes the five characters that HTML reads as markup', () => {
		expect(HtmlEscape.text(`<b class="x">Tom & Jerry's</b>`))
			.toBe('&lt;b class=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/b&gt;');
	});
});

describe('LayerPanel', () => {
	it('has one checked checkbox for each layer, with its name and its number of nodes', () => {
		const layerPanelHtmlContent = LayerPanel.render(SampleGraph.make());
		expect(layerPanelHtmlContent.match(/type="checkbox"/g)?.length).toBe(3);
		expect(layerPanelHtmlContent.match(/ checked /g)?.length).toBe(3);
		expect(layerPanelHtmlContent).toContain('data-layer-id="pull_requests"');
		expect(layerPanelHtmlContent).toMatch(/Pull requests<\/span>\s*<span class="fg-3">1<\/span>/);
	});

	it('lists only the kinds of links that the graph has, with their number', () => {
		const linkCounts = LayerPanel.linkCounts(SampleGraph.make());
		expect(Object.fromEntries(linkCounts)).toEqual({
			fixes: 1,
			merge_commit: 1,
			mentions: 1,
		});
		const layerPanelHtmlContent = LayerPanel.render(SampleGraph.make());
		expect(layerPanelHtmlContent).toContain('Merge commit');
		expect(layerPanelHtmlContent).not.toContain('Parent commit');
	});
});

describe('NodeCard', () => {
	it('shows the layer, the escaped label, the facts, the link to GitHub, and the linked nodes', () => {
		const multiLayerGraph = SampleGraph.make();
		const graphNode = {
			...multiLayerGraph.nodes[0],
			label: 'Issue 1: <script>',
			url: 'https://github.com/heidrun-org/heidrun/issues/1',
			facts: [
				{
					name: 'State',
					value: 'OPEN',
				},
			],
		};
		const linkedNodes = multiLayerGraph.nodes.slice(2);
		const nodeCardHtmlContent = NodeCard.render(graphNode, multiLayerGraph.layers[0], linkedNodes);
		expect(nodeCardHtmlContent).toContain('Issue 1: &lt;script&gt;');
		expect(nodeCardHtmlContent).not.toContain('<script>');
		expect(nodeCardHtmlContent).toContain('>State</dt>');
		expect(nodeCardHtmlContent).toContain('href="https://github.com/heidrun-org/heidrun/issues/1"');
		expect(nodeCardHtmlContent).toContain('Linked nodes: 2');
		expect(nodeCardHtmlContent).toContain('data-node-id="commit:aaa"');
	});

	it('has no link to GitHub for a node with no address, and says how many linked nodes it does not list', () => {
		const multiLayerGraph = SampleGraph.make();
		const linkedNodes = Array.from({
			length: NodeCard.MAX_LINKED_NODES + 5,
		}, (_, index) => ({
			...multiLayerGraph.nodes[3],
			id: `commit:${index}`,
		}));
		const nodeCardHtmlContent = NodeCard.render(multiLayerGraph.nodes[1], multiLayerGraph.layers[0], linkedNodes);
		expect(nodeCardHtmlContent).not.toContain('Open on GitHub');
		expect(nodeCardHtmlContent).toContain('And 5 more linked nodes.');
	});
});
