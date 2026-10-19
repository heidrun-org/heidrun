import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
	invokeMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));
const openDialogMock = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({
	open: (...args: unknown[]) => openDialogMock(...args),
}));

import { ImageDrop } from "./image_drop";
import { CompositionBar as CompositionBarStore } from '../stores/composition_bar';

const compositionBar = CompositionBarStore.forPane('pane-1');

beforeEach(() => {
	invokeMock.mockReset();
	openDialogMock.mockReset();
	ImageDrop.close('pane-1');
});

describe("ImageDrop.handleDrop", () => {
	it("adds a dropped image to the composition bar and opens it", () => {
		expect(ImageDrop.handleDrop('pane-1', ["/a.png"])).toBe("added");
		expect(compositionBar.paths).toEqual(["/a.png"]);
		expect(compositionBar.isOpen).toBe(true);
	});

	it("adds several images in the order of the drop", () => {
		expect(ImageDrop.handleDrop('pane-1', ["/a.png", "/b.JPG"])).toBe("added");
		expect(ImageDrop.handleDrop('pane-1', ["/c.heic"])).toBe("added");
		expect(compositionBar.paths).toEqual(["/a.png", "/b.JPG", "/c.heic"]);
	});

	it("ignores a file that is not an image, and keeps the images of the same drop", () => {
		expect(ImageDrop.handleDrop('pane-1', ["/notes.txt", "/a.png"])).toBe("added");
		expect(compositionBar.paths).toEqual(["/a.png"]);
	});

	it("refuses a drop with no image, and does not open the composition bar", () => {
		expect(ImageDrop.handleDrop('pane-1', ["/notes.txt", "/folder.png/readme", "/no_extension"])).toBe("not_an_image");
		expect(ImageDrop.handleDrop('pane-1', [])).toBe("not_an_image");
		expect(compositionBar.paths).toEqual([]);
		expect(compositionBar.isOpen).toBe(false);
	});

	it("does not add the same image twice, so a drop delivered twice adds it once", () => {
		expect(ImageDrop.handleDrop('pane-1', ["/twice.png"])).toBe("added");
		expect(ImageDrop.handleDrop('pane-1', ["/twice.png"])).toBe("duplicate");
		expect(compositionBar.paths).toEqual(["/twice.png"]);
	});
});

describe("ImageDrop.pickImages", () => {
	it("asks the file picker for several image files, then adds the chosen files", async () => {
		openDialogMock.mockResolvedValue(["/shots/a.png", "/shots/b.jpg"]);
		expect(await ImageDrop.pickImages('pane-1')).toBe("added");
		const options = openDialogMock.mock.calls[0][0];
		expect(options.multiple).toBe(true);
		expect(options.directory).toBe(false);
		expect(options.filters[0].extensions).toContain("png");
		expect(compositionBar.paths).toEqual(["/shots/a.png", "/shots/b.jpg"]);
	});

	it("changes nothing when the developer closes the file picker with no choice", async () => {
		compositionBar.isOpen = true;
		openDialogMock.mockResolvedValue(null);
		expect(await ImageDrop.pickImages('pane-1')).toBeNull();
		expect(compositionBar.paths).toEqual([]);
	});
});

describe("ImageDrop.remove and ImageDrop.close", () => {
	it("removes one image with its pictures", () => {
		ImageDrop.handleDrop('pane-1', ["/a.png", "/b.png"]);
		compositionBar.thumbnails["/a.png"] = "data:a";
		compositionBar.previews["/a.png"] = "data:big-a";
		ImageDrop.remove('pane-1', "/a.png");
		expect(compositionBar.paths).toEqual(["/b.png"]);
		expect("/a.png" in compositionBar.thumbnails).toBe(false);
		expect("/a.png" in compositionBar.previews).toBe(false);
	});

	it("keeps the composition bar open when the last image is removed", () => {
		ImageDrop.handleDrop('pane-1', ["/a.png"]);
		ImageDrop.remove('pane-1', "/a.png");
		expect(compositionBar.isOpen).toBe(true);
	});

	it("removes every image and the text, closes the big view, and closes the composition bar", () => {
		ImageDrop.handleDrop('pane-1', ["/a.png", "/b.png"]);
		compositionBar.text = "hello";
		ImageDrop.openViewer('pane-1', "/b.png");
		ImageDrop.close('pane-1');
		expect(compositionBar.paths).toEqual([]);
		expect(compositionBar.text).toBe("");
		expect(compositionBar.thumbnails).toEqual({});
		expect(compositionBar.previews).toEqual({});
		expect(compositionBar.viewerIndex).toBeNull();
		expect(compositionBar.isOpen).toBe(false);
	});
});

describe("ImageDrop.toggleBar", () => {
	it("opens the composition bar when it is closed, with no image and no text", () => {
		ImageDrop.toggleBar('pane-1');
		expect(compositionBar.isOpen).toBe(true);
		expect(compositionBar.paths).toEqual([]);
		expect(compositionBar.text).toBe("");
	});

	it("closes the composition bar when it is open, and removes every image and the text", () => {
		ImageDrop.handleDrop('pane-1', ["/a.png"]);
		compositionBar.text = "hello";
		ImageDrop.toggleBar('pane-1');
		expect(compositionBar.isOpen).toBe(false);
		expect(compositionBar.paths).toEqual([]);
		expect(compositionBar.text).toBe("");
	});

	it("opens the composition bar again at the next call", () => {
		ImageDrop.toggleBar('pane-1');
		ImageDrop.toggleBar('pane-1');
		ImageDrop.toggleBar('pane-1');
		expect(compositionBar.isOpen).toBe(true);
	});
});

describe("ImageDrop big view", () => {
	it("opens on the image that was clicked", () => {
		ImageDrop.handleDrop('pane-1', ["/a.png", "/b.png", "/c.png"]);
		ImageDrop.openViewer('pane-1', "/b.png");
		expect(compositionBar.viewerIndex).toBe(1);
	});

	it("moves right and left, and goes around at both ends", () => {
		ImageDrop.handleDrop('pane-1', ["/a.png", "/b.png", "/c.png"]);
		ImageDrop.openViewer('pane-1', "/a.png");
		ImageDrop.moveViewer('pane-1', -1);
		expect(compositionBar.viewerIndex).toBe(2);
		ImageDrop.moveViewer('pane-1', 1);
		expect(compositionBar.viewerIndex).toBe(0);
		ImageDrop.moveViewer('pane-1', 1);
		expect(compositionBar.viewerIndex).toBe(1);
	});

	it("does nothing when the big view is closed", () => {
		ImageDrop.handleDrop('pane-1', ["/a.png", "/b.png"]);
		ImageDrop.moveViewer('pane-1', 1);
		expect(compositionBar.viewerIndex).toBeNull();
	});

	it("closes", () => {
		ImageDrop.handleDrop('pane-1', ["/a.png"]);
		ImageDrop.openViewer('pane-1', "/a.png");
		ImageDrop.closeViewer('pane-1');
		expect(compositionBar.viewerIndex).toBeNull();
	});

	it("moves to the next image when the image on screen is removed, and closes when none is left", () => {
		ImageDrop.handleDrop('pane-1', ["/a.png", "/b.png"]);
		ImageDrop.openViewer('pane-1', "/b.png");
		ImageDrop.remove('pane-1', "/b.png");
		expect(compositionBar.viewerIndex).toBe(0);
		ImageDrop.remove('pane-1', "/a.png");
		expect(compositionBar.viewerIndex).toBeNull();
	});
});

describe("ImageDrop pictures", () => {
	it("keeps a small picture of an image that is in the composition bar", async () => {
		ImageDrop.handleDrop('pane-1', ["/a.png"]);
		invokeMock.mockResolvedValue("data:image/png;base64,AAAA");
		await ImageDrop.loadThumbnail('pane-1', "/a.png");
		expect(invokeMock).toHaveBeenCalledWith("image_preview", { path: "/a.png", longestSide: 256 });
		expect(compositionBar.thumbnails["/a.png"]).toBe("data:image/png;base64,AAAA");
	});

	it("keeps a large picture for the big view", async () => {
		ImageDrop.handleDrop('pane-1', ["/a.png"]);
		invokeMock.mockResolvedValue("data:image/png;base64,BBBB");
		await ImageDrop.loadPreview('pane-1', "/a.png");
		expect(invokeMock).toHaveBeenCalledWith("image_preview", { path: "/a.png", longestSide: 1600 });
		expect(compositionBar.previews["/a.png"]).toBe("data:image/png;base64,BBBB");
	});

	it("keeps an empty text when the picture fails", async () => {
		ImageDrop.handleDrop('pane-1', ["/a.png"]);
		invokeMock.mockRejectedValue("conversion_failed");
		await ImageDrop.loadThumbnail('pane-1', "/a.png");
		expect(compositionBar.thumbnails["/a.png"]).toBe("");
	});

	it("drops a picture that arrives after the image was removed", async () => {
		ImageDrop.handleDrop('pane-1', ["/a.png"]);
		invokeMock.mockResolvedValue("data:late");
		const pending = ImageDrop.loadThumbnail('pane-1', "/a.png");
		ImageDrop.remove('pane-1', "/a.png");
		await pending;
		expect("/a.png" in compositionBar.thumbnails).toBe(false);
	});
});

describe("ImageDrop.pasteInto", () => {
	it("pastes the images one after the other in the terminal of the pane, with Control+V", async () => {
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register('pane-1', writer);
		invokeMock.mockResolvedValue(undefined);
		const outcome = await ImageDrop.pasteInto('pane-1', ["/a.png", "/b.png"], 0);
		expect(outcome).toEqual({ pastedCount: 2, result: "pasted" });
		expect(invokeMock.mock.calls).toEqual([
			["clipboard_set_image", { path: "/a.png" }],
			["clipboard_set_image", { path: "/b.png" }],
		]);
		expect(writer).toHaveBeenCalledTimes(2);
		expect(writer).toHaveBeenCalledWith("\x16");
		ImageDrop.unregister('pane-1');
	});

	it("writes in the pane that is asked, not in another pane", async () => {
		const writerOne = vi.fn().mockResolvedValue(undefined);
		const writerTwo = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register('pane-1', writerOne);
		ImageDrop.register("pane-2", writerTwo);
		invokeMock.mockResolvedValue(undefined);
		await ImageDrop.pasteInto("pane-2", ["/a.png"], 0);
		expect(writerOne).not.toHaveBeenCalled();
		expect(writerTwo).toHaveBeenCalledTimes(1);
		ImageDrop.unregister('pane-1');
		ImageDrop.unregister("pane-2");
	});

	it("waits between two pastes and not before the first", async () => {
		vi.useFakeTimers();
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register('pane-1', writer);
		invokeMock.mockResolvedValue(undefined);
		const pending = ImageDrop.pasteInto('pane-1', ["/a.png", "/b.png"], 500);
		await vi.advanceTimersByTimeAsync(0);
		expect(writer).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(500);
		expect(await pending).toEqual({ pastedCount: 2, result: "pasted" });
		vi.useRealTimers();
		ImageDrop.unregister('pane-1');
	});

	it("stops at the first image that fails and says how many are pasted", async () => {
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register('pane-1', writer);
		invokeMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce("boom");
		const outcome = await ImageDrop.pasteInto('pane-1', ["/a.png", "/b.png", "/c.png"], 0);
		expect(outcome).toEqual({ pastedCount: 1, result: "failed" });
		expect(invokeMock).toHaveBeenCalledTimes(2);
		expect(writer).toHaveBeenCalledTimes(1);
		ImageDrop.unregister('pane-1');
	});

	it("reports a pane with no terminal and sends nothing", async () => {
		const outcome = await ImageDrop.pasteInto("pane-missing", ["/a.png"], 0);
		expect(outcome).toEqual({ pastedCount: 0, result: "no_terminal" });
		expect(invokeMock).not.toHaveBeenCalled();
	});
});
