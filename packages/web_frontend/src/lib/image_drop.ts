import { invoke } from "@tauri-apps/api/core";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ImageDrop — pastes a dropped image file in the terminal that has the focus
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The result of one drop on the window. */
export type ImageDropResult = "pasted" | "no_focused_terminal" | "not_an_image" | "failed";

/** Writes a text to the terminal that has the focus. Set by the terminal view that has the focus. */
export type FocusedTerminalWriter = (data: string) => Promise<void>;

/** The Control+V key, as the byte that a terminal sends. */
const CONTROL_V = "\x16";

export class ImageDrop {
	/** Writer of the terminal that has the focus, or null when no terminal has the focus. */
	static focusedTerminalWriter: FocusedTerminalWriter | null = null;

	/**
	 * Puts the first dropped file in the clipboard as an image, then sends Control+V to the focused terminal.
	 * @param paths Absolute paths of the dropped files.
	 * @returns What happened.
	 */
	static async handleDrop(paths: string[]): Promise<ImageDropResult> {
		const writer = ImageDrop.focusedTerminalWriter;
		if (writer === null) {
			return "no_focused_terminal";
		}
		if (paths.length === 0) {
			return "not_an_image";
		}
		try {
			await invoke("clipboard_set_image", { path: paths[0] });
		} catch (error) {
			return String(error) === "not_an_image" ? "not_an_image" : "failed";
		}
		try {
			await writer(CONTROL_V);
		} catch {
			return "failed";
		}
		return "pasted";
	}
}
