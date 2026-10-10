import { invoke } from "@tauri-apps/api/core";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ImageDrop — pastes a dropped image file in the terminal that has the focus
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The result of one drop on the window. */
export type ImageDropResult = "pasted" | "no_terminal_under_drop" | "not_an_image" | "failed";

/** Writes a text to one terminal. */
export type TerminalWriter = (data: string) => Promise<void>;

/** The Control+V key, as the byte that a terminal sends. */
const CONTROL_V = "\x16";

export class ImageDrop {
	/** Writer of every mounted terminal, keyed by the element that shows the terminal. */
	private static writers = new Map<Element, TerminalWriter>();

	/**
	 * Makes the terminal element a valid target for a drop.
	 * @param element The element that shows the terminal.
	 * @param writer Writes a text to the terminal.
	 */
	static register(element: Element, writer: TerminalWriter): void {
		ImageDrop.writers.set(element, writer);
	}

	/**
	 * Removes the terminal element from the valid targets.
	 * @param element The element that shows the terminal.
	 */
	static unregister(element: Element): void {
		ImageDrop.writers.delete(element);
	}

	/**
	 * Finds the terminal under a point of the window.
	 * @param x Horizontal position, in CSS pixels.
	 * @param y Vertical position, in CSS pixels.
	 * @returns The writer of the terminal under the point, or null when no terminal is under the point.
	 */
	static findWriterAt(x: number, y: number): TerminalWriter | null {
		let element: Element | null = document.elementFromPoint(x, y);
		while (element !== null) {
			const writer = ImageDrop.writers.get(element);
			if (writer !== undefined) {
				return writer;
			}
			element = element.parentElement;
		}
		return null;
	}

	/**
	 * Puts the first dropped file in the clipboard as an image, then sends Control+V to the terminal under the drop.
	 * @param paths Absolute paths of the dropped files.
	 * @param x Horizontal position of the drop, in CSS pixels.
	 * @param y Vertical position of the drop, in CSS pixels.
	 * @returns What happened.
	 */
	static async handleDrop(paths: string[], x: number, y: number): Promise<ImageDropResult> {
		const writer = ImageDrop.findWriterAt(x, y);
		if (writer === null) {
			return "no_terminal_under_drop";
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
