// Herdr answers the background colour question of a pane (OSC 11) itself, with black,
// because Heidrun attaches with `herdr terminal attach` and cannot tell Herdr its colours.
// Codex reads that answer once at start to colour its input area, so Heidrun sets the
// background of the pane (OSC 11) in the shell, just before Codex starts.

/** "#f6f6f4" → "rgb:f6f6/f6f6/f4f4", or null when the colour is not "#rrggbb". */
export function oscColor(hexColor: string): string | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hexColor.trim());
  if (m === null) return null;
  return "rgb:" + [m[1], m[2], m[3]].map((part) => part.toLowerCase().repeat(2)).join("/");
}

/** Prefixes `command` with a `printf` that sets the background of the pane; `command` alone when the colour is not valid. */
export function withBackground(command: string, hexColor: string): string {
  const color = oscColor(hexColor);
  if (color === null) return command;
  return `printf '\\033]11;${color}\\033\\\\'; ${command}`;
}
