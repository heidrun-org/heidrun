import type { AgentView, Snapshot } from '../mobile_types';
import { HtmlEscape } from '../html_escape';
import { AgentCard } from '../components/agent_card';
import { ScreenHeader } from '../components/screen_header';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PanesScreen — every pane that runs a coding agent, grouped by workspace and by tab
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The list of the panes. A tap on a pane opens its screen.
 */
export class PanesScreen {
	/**
	 * Draws the screen.
	 * @param snapshot The answer of the method `state`.
	 * @param isOnline True when the last call worked, false when it failed, null before the first call.
	 * @returns The HTML of the screen, without the bottom bar.
	 */
	static render(snapshot: Snapshot, isOnline: boolean | null): string {
		const workspacesHtmlContent =
			snapshot.workspaces.length === 0
				? /* html */`<div class="empty">No pane is open.</div>`
				: snapshot.workspaces
						.map((workspace) => {
							const label = HtmlEscape.escape(workspace.label);
							const workspaceHtmlContent = /* html */`
								<h2 class="eyebrow">${label}</h2>
								${PanesScreen.renderTabs(workspace.agents)}
							`;
							return workspaceHtmlContent;
						})
						.join('');
		const screenHtmlContent = /* html */`
			${ScreenHeader.renderTab('Panes', isOnline)}
			<main>${workspacesHtmlContent}</main>
		`;
		return screenHtmlContent;
	}

	/**
	 * Draws the coding agents of one workspace, one group for each tab.
	 * @param agents The coding agents of the workspace.
	 * @returns The HTML of the groups.
	 */
	private static renderTabs(agents: AgentView[]): string {
		const agentsByTab = new Map<string, AgentView[]>();
		for (const agent of agents) {
			agentsByTab.set(agent.tab, [...(agentsByTab.get(agent.tab) ?? []), agent]);
		}
		return [...agentsByTab.entries()]
			.map(([tab, tabAgents]) => {
				const rowsHtmlContent = tabAgents.map((agent) => AgentCard.renderRow(agent)).join('');
				const tabHtmlContent = /* html */`
					<h3 class="tab-title">${HtmlEscape.escape(tab)}</h3>
					<div class="list">${rowsHtmlContent}</div>
				`;
				return tabHtmlContent;
			})
			.join('');
	}
}
