import type { AgentView, Snapshot } from './mobile_types';
import { StatusLabels } from './components/status_labels';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SnapshotQueries — finds coding agents inside the answer of the method state
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Searches the answer of the method `state`.
 */
export class SnapshotQueries {
	/**
	 * Lists every coding agent of every workspace.
	 * @param snapshot The answer of the method `state`.
	 * @returns The coding agents, workspace after workspace.
	 */
	static agents(snapshot: Snapshot): AgentView[] {
		return snapshot.workspaces.flatMap((workspace) => workspace.agents);
	}

	/**
	 * Finds one coding agent by the identifier of its pane.
	 * @param snapshot The answer of the method `state`.
	 * @param paneId The identifier of the pane.
	 * @returns The coding agent, or null when no pane has this identifier.
	 */
	static agentById(snapshot: Snapshot, paneId: string): AgentView | null {
		return SnapshotQueries.agents(snapshot).find((agent) => agent.paneId === paneId) ?? null;
	}

	/**
	 * Lists the coding agents that wait for the developer: first the blocked ones, then the ones that ask a
	 * question, then the ones that finished. Inside one group, the order of the Mac stays.
	 * @param snapshot The answer of the method `state`.
	 * @returns The coding agents of the Needs you screen.
	 */
	static attentionAgents(snapshot: Snapshot): AgentView[] {
		const agents: AgentView[] = [];
		for (const paneId of snapshot.attention) {
			const agent = SnapshotQueries.agentById(snapshot, paneId);
			if (agent !== null) {
				agents.push(agent);
			}
		}
		return agents
			.map((agent, index) => ({
				agent,
				index,
			}))
			.sort((a, b) => {
				const rankA = StatusLabels.attentionRank(a.agent);
				const rankB = StatusLabels.attentionRank(b.agent);
				return rankA !== rankB ? rankA - rankB : a.index - b.index;
			})
			.map((item) => item.agent);
	}
}
