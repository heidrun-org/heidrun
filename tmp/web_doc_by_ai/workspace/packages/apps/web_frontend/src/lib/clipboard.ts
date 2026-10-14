import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { IClipboardProvider } from "@xterm/addon-clipboard";

export async function copy(text: string) {
  if (!text) return;
  try {
    await writeText(text);
  } catch {
    await navigator.clipboard?.writeText(text).catch(() => {});
  }
}

/**
 * OSC 52 bridge: when you select text inside Herdr itself, Herdr asks the terminal to
 * copy it with an OSC 52 sequence. This provider forwards it to the macOS clipboard.
 * Reading the clipboard through OSC 52 is refused on purpose: a program in a pane
 * should not be able to read what you copied elsewhere.
 */
export const osc52Provider: IClipboardProvider = {
  readText: () => "",
  writeText: (_selection, text) => copy(text),
};
