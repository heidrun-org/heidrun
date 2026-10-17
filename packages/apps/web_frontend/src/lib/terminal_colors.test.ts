import { afterEach, describe, expect, it } from "vitest";
import { isCodexCommand, oscColor, withCodexColors, withTerminalColors } from "./terminal_colors";
import { TERMINAL_THEMES } from "./terminal_themes";

/** The text before `command` that sets the colours of the terminal view in the dark theme. */
const DARK_PREFIX = "printf '\\033]10;rgb:c9c9/cdcd/d1d1\\033\\\\\\033]11;rgb:1f1f/1f1f/1f1f\\033\\\\'; ";

/** The text before `command` that sets the colours of the terminal view in the light theme. */
const LIGHT_PREFIX = "printf '\\033]10;rgb:2b2b/2f2f/3333\\033\\\\\\033]11;rgb:ffff/ffff/ffff\\033\\\\'; ";

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("oscColor", () => {
  it("converts a hexadecimal colour", () => {
    expect(oscColor("#f6f6f4")).toBe("rgb:f6f6/f6f6/f4f4");
    expect(oscColor(" #0B0C0E ")).toBe("rgb:0b0b/0c0c/0e0e");
  });

  it("refuses a colour that is not #rrggbb", () => {
    expect(oscColor("white")).toBeNull();
    expect(oscColor("#fff")).toBeNull();
    expect(oscColor("")).toBeNull();
  });
});

describe("withTerminalColors", () => {
  it("sets the text colour (OSC 10) and the background colour (OSC 11) before the command", () => {
    expect(withTerminalColors("codex", "#2b2f33", "#f6f6f4")).toBe(
      "printf '\\033]10;rgb:2b2b/2f2f/3333\\033\\\\\\033]11;rgb:f6f6/f6f6/f4f4\\033\\\\'; codex",
    );
  });

  it("keeps the command alone when the text colour is not valid", () => {
    expect(withTerminalColors("codex -m 'o3'", "", "#f6f6f4")).toBe("codex -m 'o3'");
  });

  it("keeps the command alone when the background colour is not valid", () => {
    expect(withTerminalColors("codex -m 'o3'", "#2b2f33", "white")).toBe("codex -m 'o3'");
  });
});

describe("isCodexCommand", () => {
  it("is true when the first word is codex", () => {
    expect(isCodexCommand("codex")).toBe(true);
    expect(isCodexCommand("codex resume 'abc'")).toBe(true);
    expect(isCodexCommand("  codex -m 'o3' 'fix the tab bar'")).toBe(true);
  });

  it("is false for another first word, even one that starts with codex", () => {
    expect(isCodexCommand("claude")).toBe(false);
    expect(isCodexCommand("codex_other")).toBe(false);
    expect(isCodexCommand("npm run codex")).toBe(false);
    expect(isCodexCommand("")).toBe(false);
  });
});

describe("withCodexColors", () => {
  it("uses the colours of the dark theme when the theme of the window is dark", () => {
    document.documentElement.dataset.theme = "dark";
    expect(withCodexColors("codex")).toBe(`${DARK_PREFIX}codex`);
  });

  it("uses the colours of the light theme when the theme of the window is light (issue #636)", () => {
    document.documentElement.dataset.theme = "light";
    expect(withCodexColors("codex")).toBe(`${LIGHT_PREFIX}codex`);
    expect(withCodexColors("codex resume 'abc'")).toBe(`${LIGHT_PREFIX}codex resume 'abc'`);
  });

  it("uses the colours of the dark theme when the window has no theme yet", () => {
    expect(withCodexColors("codex")).toBe(`${DARK_PREFIX}codex`);
  });

  it("leaves a command that does not start Codex alone", () => {
    document.documentElement.dataset.theme = "light";
    expect(withCodexColors("claude --model 'opus'")).toBe("claude --model 'opus'");
    expect(withCodexColors("pnpm dev")).toBe("pnpm dev");
  });

  it("reports the very colours that the terminal view draws with", () => {
    expect(oscColor(TERMINAL_THEMES.light.foreground)).toBe("rgb:2b2b/2f2f/3333");
    expect(oscColor(TERMINAL_THEMES.light.background)).toBe("rgb:ffff/ffff/ffff");
    expect(oscColor(TERMINAL_THEMES.dark.foreground)).toBe("rgb:c9c9/cdcd/d1d1");
    expect(oscColor(TERMINAL_THEMES.dark.background)).toBe("rgb:1f1f/1f1f/1f1f");
  });
});
