import { CalendarDays, type CalendarDay } from "./calendar_days";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AiCost — counts the estimated cost and the tokens of the chats of the coding agents for each day
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The identifier of a coding agent whose chats have a cost: Claude Code or Codex. */
export type AiCostAgentId = "claude" | "codex";

/** The cost and the tokens of one chat in one hour, as the command `ai_cost_in_range` gives them. */
export type AiCostHour = {
	/** The start of the hour, an ISO 8601 text in UTC. */
	at: string;
	/** The estimated cost in US dollars of the tokens of the chat in this hour, or `null` when a model of the chat has no
	 * known price. */
	costUsd: number | null;
	/** The tokens of the chat in this hour: the input tokens and the output tokens, for every model. A chat with no known
	 * price has its tokens. */
	tokens: number;
};

/** One chat, as the command `ai_cost_in_range` gives it. */
export type AiCostChat = {
	/** The identifier of the chat for its coding agent. Two workspaces that list the same chat give the same identifier. */
	id: string;
	/** The identifier of the coding agent: `claude` or `codex`. */
	codingAgent: string;
	/** The hours where the chat used tokens, the oldest first. */
	hours: AiCostHour[];
};

/** What the command `ai_cost_in_range` gives. */
export type AiCostItems = {
	/** The chats that used tokens. */
	chats: AiCostChat[];
};

/** The cost of each coding agent, in US dollars. */
export type AiCostByAgent = Record<AiCostAgentId, number>;

/** The number of tokens of each coding agent. */
export type AiTokensByAgent = Record<AiCostAgentId, number>;

/** One day of the chart. */
export type AiCostDay = CalendarDay & {
	/** The cost of the tokens that the chats used in the day, for each coding agent. */
	costByAgent: AiCostByAgent;
	/** The tokens that the chats used in the day, for each coding agent. */
	tokensByAgent: AiTokensByAgent;
};

/** The AI cost in a time range. */
export type AiCostResult = {
	/** The days of the time range, the oldest first. The last day is today. */
	days: AiCostDay[];
	/** The cost in the whole time range, for each coding agent. */
	totalByAgent: AiCostByAgent;
	/** The cost of the two coding agents in the whole time range. */
	totalCost: number;
	/** The tokens in the whole time range, for each coding agent. */
	totalTokensByAgent: AiTokensByAgent;
	/** The tokens of the two coding agents in the whole time range. */
	totalTokens: number;
	/** The number of chats that used tokens in the time range, with or without a known price. */
	chatCount: number;
	/** The number of chats that used tokens in the time range and have no known price, and count as zero. */
	chatWithoutPriceCount: number;
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
 * The calculation of the AI cost of the tab "Work of one person" of the Statistics window. It has no clock: the caller
 * gives the current time. The cost and the tokens of a chat come in hours, and each hour counts on the day that holds its
 * start, in the time zone of the computer, so a chat that lasts several days is in several days.
 */
export class AiCost {
	/**
	 * Joins the chats of several workspaces into one list. A chat that two workspaces list counts once.
	 *
	 * @param itemsOfWorkspaces - What the command `ai_cost_in_range` gave for each workspace.
	 * @returns The chats of all the workspaces, each chat once, in the order of the workspaces.
	 */
	static merge(itemsOfWorkspaces: AiCostItems[]): AiCostItems {
		const knownKeys = new Set<string>();
		const chats: AiCostChat[] = [];
		for (const items of itemsOfWorkspaces) {
			for (const chat of items.chats) {
				const key = `${chat.codingAgent}|${chat.id}`;
				if (knownKeys.has(key) === false) {
					knownKeys.add(key);
					chats.push(chat);
				}
			}
		}
		return { chats };
	}

	/**
	 * Counts the cost and the tokens of the chats for each day of a time range, and in the whole time range.
	 *
	 * @param items - The chats.
	 * @param now - The current time, in milliseconds since 1 January 1970.
	 * @param dayCount - The number of days of the time range, today included.
	 * @returns The days and the totals. A chat outside the time range, and a chat of another coding agent, are not counted.
	 * A chat with no known price has its tokens and no cost.
	 */
	static compute(items: AiCostItems, now: number, dayCount: number): AiCostResult {
		const days: AiCostDay[] = CalendarDays.build(now, dayCount).map((day) => ({
			...day,
			costByAgent: AiCost._zeroByAgent(),
			tokensByAgent: AiCost._zeroByAgent(),
		}));
		const result: AiCostResult = {
			days,
			totalByAgent: AiCost._zeroByAgent(),
			totalCost: 0,
			totalTokensByAgent: AiCost._zeroByAgent(),
			totalTokens: 0,
			chatCount: 0,
			chatWithoutPriceCount: 0,
		};
		for (const chat of items.chats) {
			const agentId = AI_COST_AGENT_IDS.find((candidate) => candidate === chat.codingAgent);
			if (agentId === undefined) {
				continue;
			}
			let isInRange = false;
			let isWithoutPrice = false;
			for (const hour of chat.hours) {
				const index = CalendarDays.findIndex(days, hour.at);
				if (index === -1) {
					continue;
				}
				isInRange = true;
				days[index].tokensByAgent[agentId] += hour.tokens;
				result.totalTokensByAgent[agentId] += hour.tokens;
				result.totalTokens += hour.tokens;
				if (hour.costUsd === null) {
					isWithoutPrice = true;
					continue;
				}
				days[index].costByAgent[agentId] += hour.costUsd;
				result.totalByAgent[agentId] += hour.costUsd;
				result.totalCost += hour.costUsd;
			}
			result.chatCount += isInRange ? 1 : 0;
			result.chatWithoutPriceCount += isWithoutPrice ? 1 : 0;
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
