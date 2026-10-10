import { describe, expect, it } from "vitest";
import { SCRIPT_NAME_LENGTH, scriptNameFromCommand } from "./script_name";

describe("scriptNameFromCommand", () => {
  it("gives a short command as it is", () => {
    expect(scriptNameFromCommand("make dev")).toBe("make dev");
  });

  it("keeps the first 20 characters of a long command", () => {
    const name = scriptNameFromCommand("pnpm --filter web_frontend test");
    expect(name).toBe("pnpm --filter web_fr");
    expect(name).toHaveLength(SCRIPT_NAME_LENGTH);
  });

  it("writes a command of several lines on one line", () => {
    expect(scriptNameFromCommand("cd web\n  pnpm install\npnpm dev")).toBe("cd web pnpm install");
  });

  it("removes the spaces at the start and at the end", () => {
    expect(scriptNameFromCommand("  make dev  ")).toBe("make dev");
    expect(scriptNameFromCommand("aaaaaaaaaaaaaaaaaaa bbb")).toBe("aaaaaaaaaaaaaaaaaaa");
  });

  it("counts a character that uses two code units as one character", () => {
    expect(Array.from(scriptNameFromCommand("🚀".repeat(30)))).toHaveLength(SCRIPT_NAME_LENGTH);
  });

  it("gives an empty name for an empty command", () => {
    expect(scriptNameFromCommand("   \n ")).toBe("");
  });
});
