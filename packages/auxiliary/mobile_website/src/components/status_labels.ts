import type { AgentView } from '../mobile_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	StatusLabels — the words and the colors of the status of a coding agent
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Decides how the page shows the status of one coding agent.
 */
export class StatusLabels {
	/** The words of each status. */
	private static readonly words: Record<string, string> = {
		blocked: 'Blocked',
		working: 'Working',
		done: 'Finished',
		idle: 'Idle',
		unknown: '—',
	};

	/**
	 * Tells if a coding agent that is not blocked asks a question.
	 * @param agent The coding agent.
	 * @returns True when the coding agent is not blocked and has a question.
	 */
	static isAskingQuestion(agent: AgentView): boolean {
		return agent.status !== 'blocked' && agent.question !== null && agent.question !== '';
	}

	/**
	 * Gives the word of the badge.
	 * @param agent The coding agent.
	 * @returns "Question" for a coding agent that asks a question, else the word of its status.
	 */
	static label(agent: AgentView): string {
		if (StatusLabels.isAskingQuestion(agent)) {
			return 'Question';
		}
		return StatusLabels.words[agent.status] ?? agent.status;
	}

	/**
	 * Gives the name of the color of the status dot and of the badge.
	 * @param agent The coding agent.
	 * @returns One of "blocked", "question", "working", "done", or "idle".
	 */
	static colorName(agent: AgentView): string {
		if (agent.status === 'blocked') {
			return 'blocked';
		}
		if (StatusLabels.isAskingQuestion(agent)) {
			return 'question';
		}
		if (agent.status === 'working' || agent.status === 'done') {
			return agent.status;
		}
		return 'idle';
	}

	/**
	 * Gives the place of a coding agent in the Needs you screen.
	 * @param agent The coding agent.
	 * @returns 0 for a blocked coding agent, 1 for one that asks a question, 2 for the others.
	 */
	static attentionRank(agent: AgentView): number {
		if (agent.status === 'blocked') {
			return 0;
		}
		return StatusLabels.isAskingQuestion(agent) ? 1 : 2;
	}
}
