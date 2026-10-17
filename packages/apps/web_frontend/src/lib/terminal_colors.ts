// Herdr answers the colour questions of a pane itself: OSC 10 asks for the text colour, OSC 11 asks for the background
// colour. Heidrun attaches with `herdr terminal attach`, which leaves these questions to the pane, so Herdr answers
// only with the colours that the shell of the pane set before. Codex asks both questions once at start, and chooses
// its light colours only when it gets both answers (issue #636). With one answer missing it keeps its dark colours,
// which are unreadable on a light background. So Heidrun sets the text colour and the background colour of the pane
// in the shell, just before Codex starts. Codex asks only once, so a Codex that already runs keeps its colours when the
// theme of Heidrun changes: the person restarts Codex to get the colours of the new theme.

import { TERMINAL_THEMES } from "./terminal_themes";

/** "#f6f6f4" → "rgb:f6f6/f6f6/f4f4", or null when the colour is not "#rrggbb". */
export function oscColor(hexColor: string): string | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hexColor.trim());
  if (m === null) {
    return null;
  }
  return "rgb:" + [m[1], m[2], m[3]].map((part) => part.toLowerCase().repeat(2)).join("/");
}

/**
 * Prefixes `command` with a `printf` that sets the text colour (OSC 10) and the background colour (OSC 11) of the pane.
 * `command` alone when one of the two colours is not valid: Codex ignores a pane that gives only one colour.
 */
export function withTerminalColors(command: string, foregroundHexColor: string, backgroundHexColor: string): string {
  const foreground = oscColor(foregroundHexColor);
  const background = oscColor(backgroundHexColor);
  if (foreground === null || background === null) {
    return command;
  }
  return `printf '\\033]10;${foreground}\\033\\\\\\033]11;${background}\\033\\\\'; ${command}`;
}

/** True when the first word of `command` is `codex`. */
export function isCodexCommand(command: string): boolean {
  return /^\s*codex(\s|$)/.test(command);
}

/**
 * Gives a command that starts Codex the colours of the terminal view in the theme that Heidrun uses now.
 * @param command - the command line that the shell of a pane runs
 * @returns `command` with the colours set before it when it starts Codex, `command` alone for any other command
 */
export function withCodexColors(command: string): string {
  if (isCodexCommand(command) === false) {
    return command;
  }
  const terminalTheme = TERMINAL_THEMES[document.documentElement.dataset.theme === "light" ? "light" : "dark"];
  return withTerminalColors(command, terminalTheme.foreground, terminalTheme.background);
}
