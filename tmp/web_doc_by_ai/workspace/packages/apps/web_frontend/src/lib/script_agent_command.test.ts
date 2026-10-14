import { describe, expect, it } from "vitest";
import { scriptAgentCommand, shellQuote } from "./script_agent_command";

describe("shellQuote", () => {
  it("puts the text in single quotes and protects a single quote inside", () => {
    expect(shellQuote("it's here")).toBe(`'it'\\''s here'`);
  });
});

describe("scriptAgentCommand", () => {
  it("starts claude with the prompt only", () => {
    expect(scriptAgentCommand({ name: "claude", prompt: " Review the last commit. " })).toBe("claude 'Review the last commit.'");
  });

  it("starts claude with the model and the effort", () => {
    expect(scriptAgentCommand({ name: "claude", model: "opus", effort: "high", prompt: "Hi" })).toBe(
      "claude --model 'opus' --effort 'high' 'Hi'",
    );
  });

  it("starts codex with the model and the effort", () => {
    expect(scriptAgentCommand({ name: "codex", model: "gpt-5", effort: "low", prompt: "Hi" })).toBe(
      `codex -m 'gpt-5' -c 'model_reasoning_effort="low"' 'Hi'`,
    );
  });

  it("keeps the lines of a prompt of several lines inside one word", () => {
    expect(scriptAgentCommand({ name: "codex", prompt: "a\nb" })).toBe("codex 'a\nb'");
  });
});
