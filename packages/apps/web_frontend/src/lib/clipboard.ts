import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { IClipboardProvider } from "@xterm/addon-clipboard";

export async function copy(text: string) {
  await writeToClipboard(text).catch(() => {});
}

/**
 * Writes the text to the macOS clipboard, through Tauri, or through the browser when Tauri fails. Unlike `copy`, it
 * rejects when no text was written, so that the caller can tell the developer (issue #803).
 */
export async function writeToClipboard(text: string): Promise<void> {
  if (!text) {
    throw new Error("Nothing to copy");
  }
  try {
    await writeText(text);
  } catch (error) {
    if (navigator.clipboard === undefined) {
      throw error;
    }
    await navigator.clipboard.writeText(text);
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
