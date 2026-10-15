import type { AgentView } from '../mobile_types';
import { HtmlEscape } from '../html_escape';
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
 * The screen of one pane that runs a coding agent. The center shows only the output of the pane, edge to edge.
 */
export class PaneScreen {
	/** The identifier of the field for a prompt. */
	static readonly promptFieldId = 'prompt-field';

	/**
	 * Draws the screen.
	 * @param agent The coding agent of the pane, or null when the pane does not exist anymore.
	 * @param output The end of the output of the pane.
	 * @returns The HTML of the screen, without the bottom bar.
	 */
	static render(agent: AgentView | null, output: string): string {
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
		const placeholder = HtmlEscape.escape(`Prompt for ${agent.name}…`);
		const outputHtmlContent = OutputText.toHtml(output);
		const shownHtmlContent = outputHtmlContent === '' ? '…' : outputHtmlContent;
		const isBlocked = agent.status === 'blocked';
		const isWorking = agent.status === 'working';
		const denyHtmlContent = isBlocked ? PaneScreen.renderDangerButton('deny', 'Refuse', paneId) : '';
		const stopHtmlContent = isWorking ? PaneScreen.renderStopButton(paneId) : '';
		const actionsHtmlContent =
			denyHtmlContent === '' ? '' : /* html */`<div class="actions">${denyHtmlContent}</div>`;
		const screenHtmlContent = /* html */`
			${ScreenHeader.renderPane(`${agent.workspace} · ${agent.tab}`, badgeHtmlContent)}
			<main class="pane-main">
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
				${stopHtmlContent}
				<button
					class="send-button"
					data-action="send"
					data-pane-id="${paneId}"
					aria-label="Send"
					title="Send (Cmd+Enter)"
				>
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M12 19V5"/>
						<path d="M5 12l7-7 7 7"/>
					</svg>
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
	 * Draws the button that interrupts a working coding agent: the stop icon, a red square, next to the button
	 * Send.
	 * @param paneId The identifier of the pane, already escaped.
	 * @returns The HTML of the button.
	 */
	private static renderStopButton(paneId: string): string {
		const buttonHtmlContent = /* html */`
			<button
				class="stop-button"
				data-action="interrupt"
				data-pane-id="${paneId}"
				aria-label="Interrupt"
				title="Interrupt (Esc)"
			>
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
					<rect x="6" y="6" width="12" height="12" rx="2"/>
				</svg>
			</button>
		`;
		return buttonHtmlContent;
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
