import { beforeEach, describe, expect, it } from "vitest";
import { chatUsageRows, costText, tokenCountText } from "./chat_usage";
import { settings } from "../stores/settings";

beforeEach(() => {
  settings.language = "en";
});

describe("tokenCountText", () => {
  it("keeps a number under one thousand as it is, and gives no full number", () => {
    expect(tokenCountText(0)).toEqual({ text: "0", full: null });
    expect(tokenCountText(84)).toEqual({ text: "84", full: null });
    expect(tokenCountText(999)).toEqual({ text: "999", full: null });
  });

  it("writes the thousands with KT, and two digits after the point", () => {
    expect(tokenCountText(1_000)).toEqual({ text: "1.00 KT", full: "1,000 tokens" });
    expect(tokenCountText(20_608)).toEqual({ text: "20.61 KT", full: "20,608 tokens" });
  });

  it("writes the millions with MT, and gives the full number", () => {
    expect(tokenCountText(3_103_109)).toEqual({ text: "3.10 MT", full: "3,103,109 tokens" });
    expect(tokenCountText(3_010_875)).toEqual({ text: "3.01 MT", full: "3,010,875 tokens" });
  });

  it("writes the billions with BT and the trillions with TT", () => {
    expect(tokenCountText(1_234_567_890)).toEqual({ text: "1.23 BT", full: "1,234,567,890 tokens" });
    expect(tokenCountText(30_748_060_082)).toEqual({ text: "30.75 BT", full: "30,748,060,082 tokens" });
    expect(tokenCountText(2_500_000_000_000)).toEqual({ text: "2.50 TT", full: "2,500,000,000,000 tokens" });
  });

  it("moves to the next unit when the rounding gives one thousand", () => {
    expect(tokenCountText(999_994).text).toBe("999.99 KT");
    expect(tokenCountText(999_995).text).toBe("1.00 MT");
    expect(tokenCountText(999_999_999).text).toBe("1.00 BT");
  });

  it("follows the language in use", () => {
    settings.language = "fr";
    const count = tokenCountText(1_500_000);
    expect(count.text).toBe("1,50 MT");
    expect(count.full?.replace(/\s/g, " ")).toBe("1 500 000 jetons");
  });
});

describe("costText", () => {
  it("gives dollars and cents", () => {
    expect(costText(12.3456)).toBe("$12.35");
    expect(costText(0.5)).toBe("$0.50");
  });

  it("says less than one cent for a cost under one cent", () => {
    expect(costText(0.004)).toBe("Less than $0.01");
    expect(costText(0)).toBe("Less than $0.01");
    expect(costText(0.01)).toBe("$0.01");
  });
});

describe("chatUsageRows", () => {
  it("gives no rows for a chat without tokens", () => {
    expect(chatUsageRows(null)).toBeNull();
    expect(chatUsageRows(undefined)).toBeNull();
  });

  it("writes the tokens and the cost as texts", () => {
    expect(chatUsageRows({ input_tokens: 5_000, cached_input_tokens: 4_000, output_tokens: 200, cost_usd: 0.012 })).toEqual({
      inputTokens: { text: "5.00 KT", full: "5,000 tokens" },
      cachedInputTokens: { text: "4.00 KT", full: "4,000 tokens" },
      outputTokens: { text: "200", full: null },
      cost: "$0.01",
    });
  });

  it("leaves out the cached tokens when there are none, and the cost when no price is known", () => {
    expect(chatUsageRows({ input_tokens: 10, cached_input_tokens: 0, output_tokens: 2, cost_usd: null })).toEqual({
      inputTokens: { text: "10", full: null },
      cachedInputTokens: null,
      outputTokens: { text: "2", full: null },
      cost: null,
    });
  });
});
