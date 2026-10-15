import type { QuotaView, Snapshot } from '../mobile_types';
import { HtmlEscape } from '../html_escape';
import { SnapshotQueries } from '../snapshot_queries';
import { ScreenHeader } from '../components/screen_header';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DashboardScreen — how many coding agents need the developer, how many work, and the usage limits
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The dashboard: the page that the button "Go to the app" of the welcome page opens. It gives the whole situation at
 * a glance, and each count is a button that opens the screen with the details.
 */
export class DashboardScreen {
	/**
	 * Draws the screen.
	 * @param snapshot The answer of the method `state`.
	 * @param isOnline True when the last call worked, false when it failed, null before the first call.
	 * @returns The HTML of the screen, without the bottom bar.
	 */
	static render(snapshot: Snapshot, isOnline: boolean | null): string {
		const agents = SnapshotQueries.agents(snapshot);
		const needYouCount = SnapshotQueries.attentionAgents(snapshot).length;
		const workingCount = agents.filter((agent) => agent.status === 'working').length;
		const summary = needYouCount === 0 ? 'Nothing waits for your decision.' : 'Open Needs you to answer.';
		const quotasHtmlContent = DashboardScreen.renderQuotas(snapshot.quotas);
		const isHot = needYouCount > 0;
		const needYouHtmlContent = DashboardScreen.renderCount('needs_you', needYouCount, 'Need you', isHot);
		const workingHtmlContent = DashboardScreen.renderCount('panes', workingCount, 'Working', false);
		const total = DashboardScreen.renderTotal(agents.length, snapshot.workspaces.length);
		const screenHtmlContent = /* html */`
			${ScreenHeader.renderTab('Dashboard', isOnline)}
			<main>
				<div class="counts">
					${needYouHtmlContent}
					${workingHtmlContent}
				</div>
				<div class="sub dashboard-summary">${summary}</div>
				${quotasHtmlContent}
				<div class="sub dashboard-total">${total}</div>
			</main>
		`;
		return screenHtmlContent;
	}

	/**
	 * Draws one count. The whole card is a button that opens a screen.
	 * @param screen The screen that the card opens.
	 * @param count The number to show.
	 * @param label The words under the number.
	 * @param isHot True to draw the number in the color of a coding agent that waits.
	 * @returns The HTML of the card.
	 */
	private static renderCount(screen: string, count: number, label: string, isHot: boolean): string {
		const className = isHot ? 'count-card count-card-hot' : 'count-card';
		const cardHtmlContent = /* html */`
			<button class="${className}" data-action="go" data-screen="${screen}">
				<span class="count-number">${HtmlEscape.escape(count)}</span>
				<span class="count-label">${HtmlEscape.escape(label)}</span>
			</button>
		`;
		return cardHtmlContent;
	}

	/**
	 * Draws the usage limits, one row with a bar for each limit.
	 * @param quotas The usage limits.
	 * @returns The HTML of the section, or an empty text when there is no limit.
	 */
	private static renderQuotas(quotas: QuotaView[]): string {
		if (quotas.length === 0) {
			return '';
		}
		const rowsHtmlContent = quotas
			.map((quota) => {
				const percent = Math.min(100, Math.max(0, Number(quota.percent) || 0));
				const rowHtmlContent = /* html */`
					<div class="usage-row">
						<span>${HtmlEscape.escape(quota.name)}</span>
						<span class="usage-percent">${HtmlEscape.escape(percent)} %</span>
						<progress class="meter" max="100" value="${percent}"></progress>
					</div>
				`;
				return rowHtmlContent;
			})
			.join('');
		const quotasHtmlContent = /* html */`
			<h2 class="eyebrow">Usage limits</h2>
			<div class="usage">${rowsHtmlContent}</div>
		`;
		return quotasHtmlContent;
	}

	private static renderTotal(agentCount: number, workspaceCount: number): string {
		const agents = agentCount === 1 ? '1 coding agent' : `${agentCount} coding agents`;
		const workspaces = workspaceCount === 1 ? '1 workspace' : `${workspaceCount} workspaces`;
		return HtmlEscape.escape(`${agents} in ${workspaces}`);
	}
}
