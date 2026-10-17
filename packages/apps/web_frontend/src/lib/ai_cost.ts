import { CalendarSlots, SLOT_HOURS_OF_A_DAY, type CalendarSlot } from "./calendar_slots";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AiCost — counts the estimated cost and the tokens of the coding agents for each slot, from the stored token usage
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The identifier of a coding agent whose chats have a cost: Claude Code or Codex. */
export type AiCostAgentId = "claude" | "codex";

/** What the data layer knows about the token usage of one workspace, as the commands `ai_cost_synchronize` and `ai_cost_in_range` give it. */
export type AiCostWorkspace = {
	/** The root of the Git repository of the workspace. */
	folder: string;
	/** The repository in the format `owner/name`, or `null` when it cannot be found. */
	repository: string | null;
	/** When the token usage of the workspace was read the last time, an ISO 8601 text, or `null` when the history of the
	 * workspace was never imported. */
	synchronizedAt: string | null;
	/** The message of the error when the workspace cannot be read, or `null`. */
	error: string | null;
};

/** What the command `ai_cost_synchronize` gives. */
export type AiCostSynchronization = {
	/** The state of each workspace after the synchronization. */
	workspaces: AiCostWorkspace[];
	/** The message of the error when the prices of the models could not be refreshed, or `null`. The latest known prices stay
	 * in use. */
	priceWarning: string | null;
};

/** The tokens and the cost of one coding agent in one hour, as the command `ai_cost_in_range` gives them. */
export type AiCostHourRow = {
	/** The start of the hour, an ISO 8601 text in UTC. An hour is a slot of one hour of a day of the time zone of the computer: it
	 * starts at the start of the day plus a whole number of hours, and it never crosses midnight. */
	startedAt: string;
	/** The date of the day that holds the hour, `YYYY-MM-DD`. */
	day: string;
	/** The identifier of the coding agent: `claude` or `codex`. */
	codingAgent: string;
	/** The tokens of the hour: the input tokens and the output tokens, for every model. */
	tokens: number;
	/** The estimated cost in US dollars of the tokens that have a known price, or `null` when no token of the hour has one. */
	costUsd: number | null;
	/** The tokens of the hour whose model has no known price. They are in `tokens` and not in `costUsd`. */
	unpricedTokens: number;
};

/** What the command `ai_cost_in_range` gives. */
export type AiCostAnswer = {
	/** The state of each workspace. A workspace that was never imported gives no day. */
	workspaces: AiCostWorkspace[];
	/** The tokens and the cost of each coding agent in each hour that had tokens, the oldest hour first. */
	hours: AiCostHourRow[];
	/** The number of the version of the prices that the costs use, or `null` when no price is stored. */
	priceVersion: number | null;
	/** When the price list was checked the last time, an ISO 8601 text, or `null` when no price is stored. */
	pricesCheckedAt: string | null;
};

/** The cost of each coding agent, in US dollars. */
export type AiCostByAgent = Record<AiCostAgentId, number>;

/** The number of tokens of each coding agent. */
export type AiTokensByAgent = Record<AiCostAgentId, number>;

/** One slot of the chart: a bar. */
export type AiCostSlot = CalendarSlot & {
	/** The cost of the tokens that the coding agents used in the slot, for each coding agent. */
	costByAgent: AiCostByAgent;
	/** The tokens that the coding agents used in the slot, for each coding agent. */
	tokensByAgent: AiTokensByAgent;
};

/** The AI cost in a time range. */
export type AiCostResult = {
	/** The slots of the time range, the oldest first. The last slot ends at the end of today. */
	slots: AiCostSlot[];
	/** The cost in the whole time range, for each coding agent. */
	totalByAgent: AiCostByAgent;
	/** The cost of the two coding agents in the whole time range. */
	totalCost: number;
	/** The tokens in the whole time range, for each coding agent. */
	totalTokensByAgent: AiTokensByAgent;
	/** The tokens of the two coding agents in the whole time range. */
	totalTokens: number;
	/** The tokens in the whole time range whose model has no known price. The cost does not count them, so it is a part of the
	 * whole cost when this number is not zero. */
	unpricedTokens: number;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Constants
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The coding agents of the chart, from the bottom of a bar to its top. */
export const AI_COST_AGENT_IDS: readonly AiCostAgentId[] = ["claude", "codex"];

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AiCost
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The calculation of the AI cost of the tab "Work of one person" of the Statistics window. It has no clock: the caller gives
 * the current time. The data layer cuts its hours in the time zone of the computer, and a slot is a whole number of hours of
 * the same days, so this class only adds each row to the slot that holds its start: a day that lasts 23 or 25 hours is one
 * slot of one day here too.
 */
export class AiCost {
	/**
	 * Gives the name of the time zone of the computer, which the data layer needs to cut the days.
	 *
	 * @returns The name of the time zone in the IANA database, for example `Europe/Paris`.
	 */
	static timeZone(): string {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	}

	/**
	 * Finds the workspaces whose history was never imported.
	 *
	 * @param workspaces - The state of each workspace.
	 * @returns The workspaces that have no date of synchronization and no error.
	 */
	static findNotImported(workspaces: AiCostWorkspace[]): AiCostWorkspace[] {
		return workspaces.filter((workspace) => workspace.synchronizedAt === null && workspace.error === null);
	}

	/**
	 * Finds the oldest date of synchronization of the workspaces that were imported. It tells how fresh the token usage is:
	 * every imported workspace is at least this fresh.
	 *
	 * @param workspaces - The state of each workspace.
	 * @returns An ISO 8601 text, or `null` when no workspace was imported.
	 */
	static findOldestSynchronizedAt(workspaces: AiCostWorkspace[]): string | null {
		const dates = workspaces.flatMap((workspace) => (workspace.synchronizedAt === null ? [] : [workspace.synchronizedAt]));
		if (dates.length === 0) {
			return null;
		}
		return dates.reduce((oldest, date) => (Date.parse(date) < Date.parse(oldest) ? date : oldest));
	}

	/**
	 * Counts the cost and the tokens of the coding agents for each slot of a time range, and in the whole time range.
	 *
	 * @param answer - What the command `ai_cost_in_range` gave.
	 * @param now - The current time, in milliseconds since 1 January 1970.
	 * @param dayCount - The number of days of the time range, today included.
	 * @param slotHours - The length of a slot in hours: 1, 6, or 24 (one day).
	 * @returns The slots and the totals. A row outside the time range, and a row of another coding agent, are not counted. The
	 * tokens that have no known price are in the tokens and not in the cost.
	 */
	static compute(answer: AiCostAnswer, now: number, dayCount: number, slotHours: number = SLOT_HOURS_OF_A_DAY): AiCostResult {
		const slots: AiCostSlot[] = CalendarSlots.build(now, dayCount, slotHours).map((slot) => ({
			...slot,
			costByAgent: AiCost._zeroByAgent(),
			tokensByAgent: AiCost._zeroByAgent(),
		}));
		const result: AiCostResult = {
			slots,
			totalByAgent: AiCost._zeroByAgent(),
			totalCost: 0,
			totalTokensByAgent: AiCost._zeroByAgent(),
			totalTokens: 0,
			unpricedTokens: 0,
		};
		for (const row of answer.hours) {
			const agentId = AI_COST_AGENT_IDS.find((candidate) => candidate === row.codingAgent);
			const index = CalendarSlots.findIndex(slots, row.startedAt);
			if (agentId === undefined || index === -1) {
				continue;
			}
			slots[index].tokensByAgent[agentId] += row.tokens;
			result.totalTokensByAgent[agentId] += row.tokens;
			result.totalTokens += row.tokens;
			result.unpricedTokens += row.unpricedTokens;
			if (row.costUsd === null) {
				continue;
			}
			slots[index].costByAgent[agentId] += row.costUsd;
			result.totalByAgent[agentId] += row.costUsd;
			result.totalCost += row.costUsd;
		}
		return result;
	}

	/**
	 * Gives an amount of zero for each coding agent: a cost, or a number of tokens.
	 *
	 * @returns The amounts.
	 */
	private static _zeroByAgent(): AiCostByAgent {
		return { claude: 0, codex: 0 };
	}
}
