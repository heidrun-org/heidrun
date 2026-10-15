import type { AgentView } from '../mobile_types';
import { HtmlEscape } from '../html_escape';
import { TimeAgo } from '../time_ago';
import { StatusLabels } from './status_labels';
import { MenuButtons } from './menu_buttons';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AgentCard — one coding agent as a card of the Needs you screen, or as a row of the Panes screen
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws one coding agent. A tap on the card or on the row opens the screen of its pane.
 */
export class AgentCard {
	/**
	 * Draws a coding agent that waits for the developer. A blocked coding agent shows its menu, so the developer
	 * can answer without opening the pane.
	 * @param agent The coding agent.
	 * @param now The current time of the Mac, in milliseconds since 1970.
	 * @returns The HTML of the card.
	 */
	static renderAttention(agent: AgentView, now: number): string {
		const color = StatusLabels.colorName(agent);
		const isBlocked = agent.status === 'blocked';
		const blockedQuestion = agent.menu?.question ?? 'Waiting for a decision';
		const questionText = isBlocked ? blockedQuestion : (agent.question ?? '');
		const detailText = isBlocked ? (agent.menu?.detail ?? '') : '';
		const questionHtmlContent = AgentCard.renderText('question', questionText);
		const detailHtmlContent = AgentCard.renderText('detail', detailText);
		const menuButtonsHtmlContent = MenuButtons.render(agent);
		const menuHtmlContent = isBlocked ? /* html */`<div class="menu">${menuButtonsHtmlContent}</div>` : '';
		const paneId = HtmlEscape.escape(agent.paneId);
		const title = HtmlEscape.escape(`${agent.workspace} · ${agent.tab}`);
		const label = HtmlEscape.escape(StatusLabels.label(agent));
		const subtitle = HtmlEscape.escape(`${agent.name} · ${TimeAgo.format(agent.since, now)}`);
		const cardHtmlContent = /* html */`
			<article class="card card-${color}" data-action="open-pane" data-pane-id="${paneId}">
				<div class="row">
					<span class="dot dot-${color}"></span>
					<span class="name">${title}</span>
					<span class="badge badge-${color}">${label}</span>
				</div>
				<div class="sub">${subtitle}</div>
				${questionHtmlContent}
				${detailHtmlContent}
				${menuHtmlContent}
			</article>
		`;
		return cardHtmlContent;
	}

	/**
	 * Draws a coding agent as one row of the Panes screen.
	 * @param agent The coding agent.
	 * @returns The HTML of the row.
	 */
	static renderRow(agent: AgentView): string {
		const paneId = HtmlEscape.escape(agent.paneId);
		const context = HtmlEscape.escape(agent.context ?? '');
		const contextHtmlContent =
			agent.context === null ? '' : /* html */`<span class="badge">${context} %</span>`;
		const rowHtmlContent = /* html */`
			<button class="card row" data-action="open-pane" data-pane-id="${paneId}">
				<span class="dot dot-${StatusLabels.colorName(agent)}"></span>
				<span class="name">${HtmlEscape.escape(agent.name)}</span>
				${contextHtmlContent}
			</button>
		`;
		return rowHtmlContent;
	}
	/**
	 * Draws one line of text of a card, or nothing when the text is empty.
	 * @param className The class of the line: `question` or `detail`.
	 * @param text The text, not escaped yet.
	 * @returns The HTML of the line, or an empty text.
	 */
	private static renderText(className: string, text: string): string {
		if (text === '') {
			return '';
		}
		const lineHtmlContent = /* html */`<div class="${className}">${HtmlEscape.escape(text)}</div>`;
		return lineHtmlContent;
	}
}
