import { describe, expect, it } from "vitest";
import { compactTokens, duration, gaugeLevel, shortPath } from "./format";

describe("shortPath", () => {
  it("replaces the home folder with a tilde", () => {
    expect(shortPath("/Users/alice/work/app")).toBe("~/work/app");
    expect(shortPath("/home/bob/app")).toBe("~/app");
  });

  it("returns an empty string for an empty value", () => {
    expect(shortPath(null)).toBe("");
    expect(shortPath(undefined)).toBe("");
  });
});

describe("compactTokens", () => {
  it("writes thousands with the letter k", () => {
    expect(compactTokens(1500)).toBe("2k");
    expect(compactTokens(999)).toBe("999");
    expect(compactTokens(null)).toBe("");
  });
});

describe("gaugeLevel", () => {
  it("returns the colour level of a percentage", () => {
    expect(gaugeLevel(10)).toBe("ok");
    expect(gaugeLevel(60)).toBe("warn");
    expect(gaugeLevel(81)).toBe("crit");
  });
});

describe("duration", () => {
  it("writes minutes and hours", () => {
    expect(duration(45_000)).toBe("< 1 min");
    expect(duration(7 * 60_000)).toBe("7 min");
    expect(duration(65 * 60_000)).toBe("1 h 05");
  });
});

import { agentKind, ago, clockTime, isAgent, paneName, statusLabel } from "./format";
import type { PaneInfo } from "./types";

const pane = (extra: Partial<PaneInfo>): PaneInfo =>
  ({ pane_id: "p", terminal_id: "t", workspace_id: "w", tab_id: "tab", focused: false, agent_status: "idle", revision: 1, ...extra }) as PaneInfo;

describe("paneName", () => {
  it("prefers the label", () => {
    expect(paneName(pane({ label: "Mine", agent: "claude" }))).toBe("Mine");
  });

  it("falls back through the display name, the agent and the terminal title", () => {
    expect(paneName(pane({ display_agent: "Claude Code", agent: "claude" }))).toBe("Claude Code");
    expect(paneName(pane({ agent: "claude" }))).toBe("claude");
    expect(paneName(pane({ terminal_title_stripped: "vim" }))).toBe("vim");
  });

  it("ends with the word shell", () => {
    expect(paneName(pane({}))).toBe("shell");
  });
});

describe("isAgent", () => {
  it("is true only when the pane has an agent", () => {
    expect(isAgent(pane({ agent: "claude" }))).toBe(true);
    expect(isAgent(pane({ agent: null }))).toBe(false);
  });
});

describe("agentKind", () => {
  it("names Claude and Codex whatever the letter case", () => {
    expect(agentKind({ agent: "CLAUDE-code" })).toBe("Claude");
    expect(agentKind({ agent: "codex" })).toBe("Codex");
  });

  it("falls back to the display name, then to Terminal", () => {
    expect(agentKind({ agent: "aider", display_agent: "Aider" })).toBe("Aider");
    expect(agentKind({ agent: null, display_agent: null })).toBe("Terminal");
  });
});

describe("ago", () => {
  it("says just now under one minute", () => {
    expect(ago(Date.now() - 5_000)).toBe(statusFreeJustNow());
  });

  it("counts minutes and hours", () => {
    expect(ago(Date.now() - 5 * 60_000)).toContain("5");
    expect(ago(Date.now() - 3 * 3_600_000)).toContain("3");
  });
});

function statusFreeJustNow(): string {
  return ago(Date.now());
}

describe("clockTime", () => {
  it("returns an empty string without a time", () => {
    expect(clockTime(null)).toBe("");
    expect(clockTime(0)).toBe("");
  });

  it("shows only the time for today", () => {
    expect(clockTime(Date.now() / 1000)).toMatch(/\d{1,2}:\d{2}/);
  });

  it("adds the day for another date", () => {
    const text = clockTime(new Date(2020, 0, 6, 10, 30).getTime() / 1000);
    expect(text.split(" ").length).toBeGreaterThan(1);
  });
});

describe("statusLabel", () => {
  it("returns a text for every status", () => {
    for (const status of ["idle", "working", "blocked", "done", "unknown"] as const) {
      expect(statusLabel(status)).not.toContain("format.status");
    }
  });
});
