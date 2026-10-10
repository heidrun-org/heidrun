import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { ImageDrop } from "./image_drop";

describe("ImageDrop.handleDrop", () => {
	beforeEach(() => {
		invokeMock.mockReset();
		ImageDrop.focusedTerminalWriter = null;
	});

	it("does nothing when no terminal has the focus", async () => {
		expect(await ImageDrop.handleDrop(["/a.png"])).toBe("no_focused_terminal");
		expect(invokeMock).not.toHaveBeenCalled();
	});

	it("puts the image in the clipboard, then sends Control+V", async () => {
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.focusedTerminalWriter = writer;
		invokeMock.mockResolvedValue(undefined);
		expect(await ImageDrop.handleDrop(["/a.png"])).toBe("pasted");
		expect(invokeMock).toHaveBeenCalledWith("clipboard_set_image", { path: "/a.png" });
		expect(writer).toHaveBeenCalledWith("\x16");
	});

	it("sends nothing when the file is not an image", async () => {
		const writer = vi.fn();
		ImageDrop.focusedTerminalWriter = writer;
		invokeMock.mockRejectedValue("not_an_image");
		expect(await ImageDrop.handleDrop(["/a.txt"])).toBe("not_an_image");
		expect(writer).not.toHaveBeenCalled();
	});

	it("reports a failure of the clipboard command", async () => {
		const writer = vi.fn();
		ImageDrop.focusedTerminalWriter = writer;
		invokeMock.mockRejectedValue("boom");
		expect(await ImageDrop.handleDrop(["/a.png"])).toBe("failed");
		expect(writer).not.toHaveBeenCalled();
	});
});
