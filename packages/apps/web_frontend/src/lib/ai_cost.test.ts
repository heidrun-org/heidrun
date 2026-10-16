import { describe, expect, it } from "vitest";
import { AiCost, type AiCostChat } from "./ai_cost";

/** Wednesday 14 October 2026, 15:00 in the time zone of the computer. */
const NOW = new Date(2026, 9, 14, 15, 0, 0).getTime();

/** The time `hour` o'clock of `monthDay` October 2026, at the clock of the computer, as an ISO 8601 text. */
function at(monthDay: number, hour: number): string {
	return new Date(2026, 9, monthDay, hour).toISOString();
}

/** The number of chats that the tests built: each chat has its own identifier, unless the test gives one. */
let chatCount = 0;

/**
 * A chat of one coding agent with the hours `[monthDay, hour, costUsd, tokens]`. The tokens are 0 when the hour gives none.
 * The chat has a new identifier, unless `id` is given.
 */
function chat(codingAgent: string, hours: Array<[number, number, number | null, number?]>, id?: string): AiCostChat {
	chatCount += 1;
	return {
		id: id ?? `chat-${chatCount}`,
		codingAgent,
		hours: hours.map(([monthDay, hour, costUsd, tokens]) => ({ at: at(monthDay, hour), costUsd, tokens: tokens ?? 0 })),
	};
}

describe("AiCost.compute", () => {
	const chats = [
		chat("claude", [
			[14, 10, 2.5],
			[14, 20, 1.25],
		]),
		chat("codex", [[14, 9, 0.5]]),
		chat("claude", [[12, 11, 4]]),
		chat("codex", [[9, 8, 1]]),
		chat("codex", [[8, 8, 0.75]]),
		chat("claude", [[7, 8, 100]]),
	];

	it("gives one day for each day of the time range, the last day being today", () => {
		const result = AiCost.compute({ chats }, NOW, 7);
		expect(result.days).toHaveLength(7);
		expect(result.days[0].startedAt).toBe(new Date(2026, 9, 8).getTime());
		expect(result.days[6].startedAt).toBe(new Date(2026, 9, 14).getTime());
	});

	it("adds the cost of each hour of each coding agent on the day of the hour", () => {
		const result = AiCost.compute({ chats }, NOW, 7);
		expect(result.days.map((day) => [day.costByAgent.claude, day.costByAgent.codex])).toEqual([
			[0, 0.75],
			[0, 1],
			[0, 0],
			[0, 0],
			[4, 0],
			[0, 0],
			[3.75, 0.5],
		]);
	});

	it("puts a chat that lasts three days in three days, with the cost of each day", () => {
		const longChat = chat("claude", [
			[12, 22, 1],
			[13, 3, 2],
			[13, 23, 0.5],
			[14, 1, 4],
		]);
		const result = AiCost.compute({ chats: [longChat] }, NOW, 7);
		expect(result.days.slice(4).map((day) => day.costByAgent.claude)).toEqual([1, 2.5, 4]);
		expect(result.chatCount).toBe(1);
		expect(result.totalCost).toBe(7.5);
	});

	it("gives the cost of each coding agent and the total of the time range, and ignores an hour that is older", () => {
		const result = AiCost.compute({ chats }, NOW, 7);
		expect(result.totalByAgent).toEqual({ claude: 7.75, codex: 2.25 });
		expect(result.totalCost).toBe(10);
		expect(result.chatCount).toBe(5);
	});

	it("counts a chat that has only some hours in the time range once, with these hours", () => {
		const result = AiCost.compute({ chats: [chat("claude", [[7, 8, 100], [8, 8, 1], [9, 8, 2]])] }, NOW, 7);
		expect(result.chatCount).toBe(1);
		expect(result.totalCost).toBe(3);
	});

	it("counts the older hours again in a longer time range", () => {
		const result = AiCost.compute({ chats }, NOW, 30);
		expect(result.days).toHaveLength(30);
		expect(result.totalByAgent.claude).toBe(107.75);
		expect(result.chatCount).toBe(6);
	});

	it("counts a chat with no known price as a chat with no cost, once, and tells how many there are", () => {
		const unpriced = chat("claude", [
			[14, 10, null],
			[13, 10, null],
		]);
		const result = AiCost.compute({ chats: [unpriced, chat("codex", [[14, 10, 2]])] }, NOW, 7);
		expect(result.chatCount).toBe(2);
		expect(result.chatWithoutPriceCount).toBe(1);
		expect(result.totalCost).toBe(2);
	});

	it("does not count a chat with no known price when all its hours are outside the time range", () => {
		const result = AiCost.compute({ chats: [chat("claude", [[1, 10, null]])] }, NOW, 7);
		expect(result.chatCount).toBe(0);
		expect(result.chatWithoutPriceCount).toBe(0);
	});

	it("ignores a chat of another coding agent and an hour that is not a time", () => {
		const result = AiCost.compute(
			{
				chats: [
					chat("antigravity", [[14, 10, 5]]),
					{ id: "chat-bad-hour", codingAgent: "claude", hours: [{ at: "yesterday", costUsd: 5, tokens: 500 }] },
				],
			},
			NOW,
			7,
		);
		expect(result.chatCount).toBe(0);
		expect(result.totalCost).toBe(0);
		expect(result.totalTokens).toBe(0);
	});

	it("gives days with a cost of zero and no token when there is no chat", () => {
		const result = AiCost.compute({ chats: [] }, NOW, 7);
		expect(result.days.every((day) => day.costByAgent.claude === 0 && day.costByAgent.codex === 0)).toBe(true);
		expect(result.days.every((day) => day.tokensByAgent.claude === 0 && day.tokensByAgent.codex === 0)).toBe(true);
		expect(result.totalCost).toBe(0);
		expect(result.totalTokens).toBe(0);
	});
});

describe("AiCost.compute, the tokens", () => {
	const chats = [
		chat("claude", [
			[14, 10, 2.5, 1_000],
			[14, 20, 1.25, 500],
		]),
		chat("codex", [[14, 9, 0.5, 200]]),
		chat("claude", [[12, 11, 4, 3_000]]),
		chat("claude", [[7, 8, 100, 90_000]]),
	];

	it("adds the tokens of each hour of each coding agent on the day of the hour", () => {
		const result = AiCost.compute({ chats }, NOW, 7);
		expect(result.days.map((day) => [day.tokensByAgent.claude, day.tokensByAgent.codex])).toEqual([
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[3_000, 0],
			[0, 0],
			[1_500, 200],
		]);
	});

	it("gives the tokens of each coding agent and the total of the time range, and ignores an hour that is older", () => {
		const result = AiCost.compute({ chats }, NOW, 7);
		expect(result.totalTokensByAgent).toEqual({ claude: 4_500, codex: 200 });
		expect(result.totalTokens).toBe(4_700);
	});

	it("counts the older hours again in a longer time range", () => {
		const result = AiCost.compute({ chats }, NOW, 30);
		expect(result.totalTokensByAgent.claude).toBe(94_500);
		expect(result.totalTokens).toBe(94_700);
	});

	it("counts the tokens of a chat with no known price, and counts no cost for it", () => {
		const unpriced = chat("claude", [
			[14, 10, null, 700],
			[13, 10, null, 300],
		]);
		const result = AiCost.compute({ chats: [unpriced, chat("codex", [[14, 10, 2, 50]])] }, NOW, 7);
		expect(result.totalTokensByAgent).toEqual({ claude: 1_000, codex: 50 });
		expect(result.days.map((day) => day.tokensByAgent.claude).slice(5)).toEqual([300, 700]);
		expect(result.totalCost).toBe(2);
		expect(result.chatWithoutPriceCount).toBe(1);
	});
});

describe("AiCost.merge", () => {
	it("joins the chats of several workspaces, in the order of the workspaces", () => {
		const first = { chats: [chat("claude", [[14, 10, 1]], "a"), chat("codex", [[14, 10, 2]], "b")] };
		const second = { chats: [chat("claude", [[14, 11, 3]], "c")] };
		expect(AiCost.merge([first, second]).chats.map((one) => one.id)).toEqual(["a", "b", "c"]);
	});

	it("counts a chat once when two workspaces list it", () => {
		const shared = chat("claude", [[14, 10, 5, 100]], "same");
		const merged = AiCost.merge([{ chats: [shared] }, { chats: [{ ...shared }, chat("claude", [[14, 11, 1, 10]], "other")] }]);
		expect(merged.chats.map((one) => one.id)).toEqual(["same", "other"]);
		const result = AiCost.compute(merged, NOW, 7);
		expect(result.totalCost).toBe(6);
		expect(result.totalTokens).toBe(110);
	});

	it("counts two chats with the same identifier once for each coding agent", () => {
		const merged = AiCost.merge([{ chats: [chat("claude", [[14, 10, 1]], "same"), chat("codex", [[14, 10, 1]], "same")] }]);
		expect(merged.chats).toHaveLength(2);
	});

	it("gives no chat when there is no workspace", () => {
		expect(AiCost.merge([])).toEqual({ chats: [] });
	});
});
