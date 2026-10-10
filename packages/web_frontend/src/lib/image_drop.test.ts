import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { ImageDrop } from "./image_drop";

/** Makes `document.elementFromPoint` return the given element. */
function putElementUnderDrop(element: Element | null): void {
	(document as unknown as { elementFromPoint: () => Element | null }).elementFromPoint = () => element;
}

describe("ImageDrop.handleDrop", () => {
	const terminalElement = document.createElement("div");
	const terminalChild = document.createElement("span");
	terminalElement.appendChild(terminalChild);
	const sidebarElement = document.createElement("div");

	beforeEach(() => {
		invokeMock.mockReset();
		ImageDrop.unregister(terminalElement);
	});

	it("refuses a drop on the sidebar", async () => {
		const writer = vi.fn();
		ImageDrop.register(terminalElement, writer);
		putElementUnderDrop(sidebarElement);
		expect(await ImageDrop.handleDrop(["/a.png"], 1, 1)).toBe("no_terminal_under_drop");
		expect(invokeMock).not.toHaveBeenCalled();
		expect(writer).not.toHaveBeenCalled();
	});

	it("writes in the terminal under the drop, whatever the focus", async () => {
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register(terminalElement, writer);
		putElementUnderDrop(terminalChild);
		invokeMock.mockResolvedValue(undefined);
		expect(await ImageDrop.handleDrop(["/a.png"], 1, 1)).toBe("pasted");
		expect(invokeMock).toHaveBeenCalledWith("clipboard_set_image", { path: "/a.png" });
		expect(writer).toHaveBeenCalledWith("\x16");
	});

	it("sends nothing when the file is not an image", async () => {
		const writer = vi.fn();
		ImageDrop.register(terminalElement, writer);
		putElementUnderDrop(terminalElement);
		invokeMock.mockRejectedValue("not_an_image");
		expect(await ImageDrop.handleDrop(["/a.txt"], 1, 1)).toBe("not_an_image");
		expect(writer).not.toHaveBeenCalled();
	});

	it("reports a failure of the clipboard command", async () => {
		const writer = vi.fn();
		ImageDrop.register(terminalElement, writer);
		putElementUnderDrop(terminalElement);
		invokeMock.mockRejectedValue("boom");
		expect(await ImageDrop.handleDrop(["/a.png"], 1, 1)).toBe("failed");
		expect(writer).not.toHaveBeenCalled();
	});
});
