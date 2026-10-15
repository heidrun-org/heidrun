import type { MarkdownOptions } from 'vitepress';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TroubleshootingPanels — separates troubleshooting topics in generated documentation
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The Markdown renderer supplied by the installed VitePress configuration. */
type MarkdownRenderer = Parameters<NonNullable<MarkdownOptions['config']>>[0];

/** Adds semantic topic panels without changing generated documentation text. */
export class TroubleshootingPanels {
	/**
	 * Registers a rendering rule for user documentation pages.
	 * @param markdown The site's Markdown renderer.
	 * @returns Nothing.
	 */
	static configure(markdown: MarkdownRenderer): void {
		markdown.core.ruler.after('block', 'documentation-troubleshooting', (state) => {
			if (typeof state.env.relativePath !== 'string' || state.env.relativePath.startsWith('documentation/') === false) {
				return;
			}
			const tokens: typeof state.tokens = [];
			let isTroubleshooting = false;
			let isPanelOpen = false;
			for (let index = 0; index < state.tokens.length; index++) {
				const token = state.tokens[index];
				const title = state.tokens[index + 1]?.content ?? '';
				if (token.type === 'heading_open' && (token.tag === 'h2' || token.tag === 'h1')) {
					if (isPanelOpen === true) {
						const close = new state.Token('html_block', '', 0);
						close.content = '</section>\n';
						tokens.push(close);
						isPanelOpen = false;
					}
					isTroubleshooting = token.tag === 'h2' && title === 'Troubleshooting';
				}
				if (isTroubleshooting === true && token.type === 'heading_open' && token.tag === 'h3') {
					if (isPanelOpen === true) {
						const close = new state.Token('html_block', '', 0);
						close.content = '</section>\n';
						tokens.push(close);
					}
					const open = new state.Token('html_block', '', 0);
					const label = markdown.utils.escapeHtml(title);
					const openHtmlContent = /* html */`<section class="documentation-troubleshooting-topic" aria-label="${label}">\n`;
					open.content = openHtmlContent;
					tokens.push(open);
					isPanelOpen = true;
				}
				tokens.push(token);
			}
			if (isPanelOpen === true) {
				const close = new state.Token('html_block', '', 0);
				close.content = '</section>\n';
				tokens.push(close);
			}
			state.tokens = tokens;
		});
	}
}
