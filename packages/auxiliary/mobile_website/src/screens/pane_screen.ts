import type { AgentView } from '../mobile_types';
import { HtmlEscape } from '../html_escape';
import { TimeAgo } from '../time_ago';
import { OutputText } from '../output_text';
import { StatusLabels } from '../components/status_labels';
import { MenuButtons } from '../components/menu_buttons';
import { ScreenHeader } from '../components/screen_header';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneScreen — one pane: the end of its output, its menu, a field for a prompt, and the buttons that stop it
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The screen of one pane that runs a coding agent.
 */
export class PaneScreen {
	/** The identifier of the field for a prompt. */
	static readonly promptFieldId = 'prompt-field';

	/**
	 * Draws the screen.
	 * @param agent The coding agent of the pane, or null when the pane does not exist anymore.
	 * @param output The end of the output of the pane.
	 * @param now The current time of the Mac, in milliseconds since 1970.
	 * @returns The HTML of the screen, without the bottom bar.
	 */
	static render(agent: AgentView | null, output: string, now: number): string {
		if (agent === null) {
			const missingHtmlContent = /* html */`
				${ScreenHeader.renderPane('Coding agent', '')}
				<main><div class="empty">This coding agent does not exist anymore.</div></main>
			`;
			return missingHtmlContent;
		}
		const color = StatusLabels.colorName(agent);
		const label = HtmlEscape.escape(StatusLabels.label(agent));
		const badgeHtmlContent = /* html */`<span class="badge badge-${color}">${label}</span>`;
		const paneId = HtmlEscape.escape(agent.paneId);
		const contextText = agent.context === null ? '' : ` · context ${agent.context} %`;
		const ageText = TimeAgo.format(agent.since, now);
		const subtitle = HtmlEscape.escape(`${agent.name}${contextText} · ${ageText}`);
		const placeholder = HtmlEscape.escape(`Prompt for ${agent.name}…`);
		const outputHtmlContent = OutputText.toHtml(output);
		const shownHtmlContent = outputHtmlContent === '' ? '…' : outputHtmlContent;
		const isBlocked = agent.status === 'blocked';
		const isWorking = agent.status === 'working';
		const denyHtmlContent = isBlocked ? PaneScreen.renderDangerButton('deny', 'Refuse', paneId) : '';
		const interruptHtmlContent =
			isWorking ? PaneScreen.renderDangerButton('interrupt', 'Interrupt', paneId) : '';
		const hasActions = denyHtmlContent !== '' || interruptHtmlContent !== '';
		const buttonsHtmlContent = `${denyHtmlContent}${interruptHtmlContent}`;
		const actionsHtmlContent =
			hasActions ? /* html */`<div class="actions">${buttonsHtmlContent}</div>` : '';
		const screenHtmlContent = /* html */`
			${ScreenHeader.renderPane(`${agent.workspace} · ${agent.tab}`, badgeHtmlContent)}
			<main class="pane-main">
				<div class="sub">${subtitle}</div>
				${PaneScreen.renderQuestion(agent)}
				<pre class="output"><code class="output-text">${shownHtmlContent}</code></pre>
				${actionsHtmlContent}
			</main>
			<div class="composer">
				<textarea
					id="${PaneScreen.promptFieldId}"
					placeholder="${placeholder}"
					rows="1"
					enterkeyhint="send"
				></textarea>
				<button class="button button-primary" data-action="send" data-pane-id="${paneId}">
					Send
				</button>
			</div>
		`;
		return screenHtmlContent;
	}

	/**
	 * Draws what the coding agent waits for: its menu when it is blocked, or its question.
	 * @param agent The coding agent.
	 * @returns The HTML of the question, or an empty text.
	 */
	private static renderQuestion(agent: AgentView): string {
		if (agent.status === 'blocked' && agent.menu !== null) {
			const menuHtmlContent = /* html */`
				<div class="menu">
					${PaneScreen.renderLine('question', agent.menu.question)}
					${PaneScreen.renderLine('detail', agent.menu.detail)}
					${MenuButtons.render(agent)}
				</div>
			`;
			return menuHtmlContent;
		}
		if (agent.status === 'blocked') {
			const waitingText = 'Waiting for a decision: read the end of the output below.';
			return PaneScreen.renderLine('question', waitingText);
		}
		return PaneScreen.renderLine('question', agent.question);
	}

	/**
	 * Draws one line of text, or nothing when there is no text.
	 * @param className The class of the line: `question` or `detail`.
	 * @param text The text, not escaped yet, or null.
	 * @returns The HTML of the line, or an empty text.
	 */
	private static renderLine(className: string, text: string | null): string {
		if (text === null || text === '') {
			return '';
		}
		const lineHtmlContent = /* html */`<div class="${className}">${HtmlEscape.escape(text)}</div>`;
		return lineHtmlContent;
	}

	/**
	 * Draws a red button that sends a key to the coding agent.
	 * @param action The name of the action that the page sends.
	 * @param label The text of the button.
	 * @param paneId The identifier of the pane, already escaped.
	 * @returns The HTML of the button.
	 */
	private static renderDangerButton(action: string, label: string, paneId: string): string {
		const buttonHtmlContent = /* html */`
			<button class="button button-danger" data-action="${action}" data-pane-id="${paneId}">
				${label}
			</button>
		`;
		return buttonHtmlContent;
	}
}
