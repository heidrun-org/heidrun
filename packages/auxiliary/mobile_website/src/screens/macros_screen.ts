import type { AgentView, MacroView, Snapshot } from '../mobile_types';
import { HtmlEscape } from '../html_escape';
import { ScreenHeader } from '../components/screen_header';
import { StatusLabels } from '../components/status_labels';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MacrosScreen — the macros, and the choice of the pane that receives one
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The list of the macros. A tap on a macro shows the panes that can receive it. A tap on a pane sends the macro to
 * its coding agent, as a prompt.
 */
export class MacrosScreen {
	/**
	 * Gives the key that names one macro on the page. Two sources can have a macro with the same identifier.
	 * @param macro The macro.
	 * @returns The source, the workspace, and the identifier of the macro, in one text.
	 */
	static keyOf(macro: MacroView): string {
		return `${macro.source}:${macro.workspaceId ?? ''}:${macro.id}`;
	}

	/**
	 * Draws the screen.
	 * @param macros The answer of the method `macros`, or null before the first answer.
	 * @param chosen The macro that the developer tapped, or null when the screen shows the list.
	 * @param snapshot The answer of the method `state`, which gives the panes.
	 * @param isOnline True when the last call worked, false when it failed, null before the first call.
	 * @returns The HTML of the screen, without the bottom bar.
	 */
	static render(
		macros: MacroView[] | null,
		chosen: MacroView | null,
		snapshot: Snapshot,
		isOnline: boolean | null,
	): string {
		const mainHtmlContent =
			chosen === null ? MacrosScreen.renderList(macros) : MacrosScreen.renderPanes(chosen, snapshot);
		const screenHtmlContent = /* html */`
			${ScreenHeader.renderTab('Macros', isOnline)}
			<main>${mainHtmlContent}</main>
		`;
		return screenHtmlContent;
	}

	/**
	 * Draws the macros: the personal macros first, then the macros of each project.
	 * @param macros The macros, or null before the first answer.
	 * @returns The HTML of the list.
	 */
	private static renderList(macros: MacroView[] | null): string {
		if (macros === null) {
			const loadingHtmlContent = /* html */`<div class="empty">Loading the macros…</div>`;
			return loadingHtmlContent;
		}
		if (macros.length === 0) {
			const emptyHtmlContent = /* html */`
				<div class="empty">No macro. Add a macro in Heidrun on the computer.</div>
			`;
			return emptyHtmlContent;
		}
		const macrosByGroup = new Map<string, MacroView[]>();
		for (const macro of macros) {
			const group = macro.source === 'personal' ? 'My macros' : `Project · ${macro.workspace ?? ''}`;
			macrosByGroup.set(group, [...(macrosByGroup.get(group) ?? []), macro]);
		}
		return [...macrosByGroup.entries()]
			.map(([group, groupMacros]) => {
				const rowsHtmlContent = groupMacros.map((macro) => MacrosScreen.renderMacro(macro)).join('');
				const groupHtmlContent = /* html */`
					<h2 class="eyebrow">${HtmlEscape.escape(group)}</h2>
					<div class="list">${rowsHtmlContent}</div>
				`;
				return groupHtmlContent;
			})
			.join('');
	}

	/**
	 * Draws one macro as a button.
	 * @param macro The macro.
	 * @returns The HTML of the button.
	 */
	private static renderMacro(macro: MacroView): string {
		const descriptionHtmlContent =
			macro.description === ''
				? ''
				: /* html */`<span class="sub">${HtmlEscape.escape(macro.description)}</span>`;
		const macroHtmlContent = /* html */`
			<button
				class="card macro"
				data-action="pick-macro"
				data-macro-key="${HtmlEscape.escape(MacrosScreen.keyOf(macro))}"
			>
				<span class="name">${HtmlEscape.escape(macro.label)}</span>
				${descriptionHtmlContent}
			</button>
		`;
		return macroHtmlContent;
	}

	/**
	 * Draws the panes that can receive the chosen macro, and a button that goes back to the list.
	 * @param chosen The macro that the developer tapped.
	 * @param snapshot The answer of the method `state`.
	 * @returns The HTML of the choice.
	 */
	private static renderPanes(chosen: MacroView, snapshot: Snapshot): string {
		const agents = snapshot.workspaces.flatMap((workspace) => workspace.agents);
		const rowsHtmlContent =
			agents.length === 0
				? /* html */`<div class="empty">No pane runs a coding agent.</div>`
				: /* html */`<div class="list">${agents.map((agent) => MacrosScreen.renderPane(agent)).join('')}</div>`;
		const choiceHtmlContent = /* html */`
			<h2 class="eyebrow">Send the macro “${HtmlEscape.escape(chosen.label)}” to</h2>
			${rowsHtmlContent}
			<div class="actions">
				<button class="button" data-action="cancel-macro">Cancel</button>
			</div>
		`;
		return choiceHtmlContent;
	}

	/**
	 * Draws one pane that can receive the macro. A blocked coding agent cannot receive a prompt before the developer
	 * answers its menu, so its row is disabled.
	 * @param agent The coding agent of the pane.
	 * @returns The HTML of the row.
	 */
	private static renderPane(agent: AgentView): string {
		const isBlocked = agent.status === 'blocked';
		const title = HtmlEscape.escape(`${agent.workspace} · ${agent.tab}`);
		const label = HtmlEscape.escape(StatusLabels.label(agent));
		const color = StatusLabels.colorName(agent);
		const rowHtmlContent = /* html */`
			<button
				class="card row"
				data-action="send-macro"
				data-pane-id="${HtmlEscape.escape(agent.paneId)}"
				${isBlocked ? 'disabled' : ''}
			>
				<span class="dot dot-${color}"></span>
				<span class="name">${title}</span>
				<span class="badge badge-${color}">${label}</span>
			</button>
		`;
		return rowHtmlContent;
	}
}
