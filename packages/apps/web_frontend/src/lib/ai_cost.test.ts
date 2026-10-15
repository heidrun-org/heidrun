import { describe, expect, it } from "vitest";
import { AiCost, type AiCostChat } from "./ai_cost";

/** Wednesday 14 October 2026, 15:00 in the time zone of the computer. */
const NOW = new Date(2026, 9, 14, 15, 0, 0).getTime();

/** The time `hour` o'clock of `monthDay` October 2026, at the clock of the computer, as an ISO 8601 text. */
function at(monthDay: number, hour: number): string {
	return new Date(2026, 9, monthDay, hour).toISOString();
}

/** A chat of one coding agent with the hours `[monthDay, hour, costUsd]`. */
function chat(codingAgent: string, hours: Array<[number, number, number | null]>): AiCostChat {
	return { codingAgent, hours: hours.map(([monthDay, hour, costUsd]) => ({ at: at(monthDay, hour), costUsd })) };
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
					{ codingAgent: "claude", hours: [{ at: "yesterday", costUsd: 5 }] },
				],
			},
			NOW,
			7,
		);
		expect(result.chatCount).toBe(0);
		expect(result.totalCost).toBe(0);
	});

	it("gives days with a cost of zero when there is no chat", () => {
		const result = AiCost.compute({ chats: [] }, NOW, 7);
		expect(result.days.every((day) => day.costByAgent.claude === 0 && day.costByAgent.codex === 0)).toBe(true);
		expect(result.totalCost).toBe(0);
	});
});
