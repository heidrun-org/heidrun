import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));
const openDialogMock = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: (...args: unknown[]) => openDialogMock(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}), emit: vi.fn() }));
vi.mock("@tauri-apps/api/path", () => ({}));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ onDragDropEvent: vi.fn(async () => () => {}) }) }));
const insertTextMock = vi.fn();
vi.mock("../stores/session", async (importOriginal) => {
	const original = await importOriginal<typeof import("../stores/session")>();
	return {
		...original,
		insertText: (...args: unknown[]) => insertTextMock(...args),
	};
});

import CompositionBar from "./CompositionBar.vue";
import { ImageDrop } from "../lib/image_drop";
import { compositionBar } from "../stores/composition_bar";

beforeEach(() => {
	invokeMock.mockReset();
	invokeMock.mockResolvedValue("data:image/png;base64,AAAA");
	openDialogMock.mockReset();
	insertTextMock.mockReset();
	insertTextMock.mockResolvedValue(undefined);
	ImageDrop.close();
});

/** Mounts the composition bar for the pane `pane-1`. */
function mountBar() {
	return mount(CompositionBar, { props: { paneId: "pane-1" }, attachTo: document.body });
}

/** Finds the button whose text starts with `text`. */
function findButton(wrapper: ReturnType<typeof mountBar>, text: string) {
	return wrapper.findAll("button").find((button) => button.text().startsWith(text));
}

describe("CompositionBar", () => {
	it("shows one picture for each image, with a count", async () => {
		ImageDrop.handleDrop(["/shots/a.png", "/shots/b.png"]);
		const wrapper = mountBar();
		await vi.waitFor(() => expect(wrapper.findAll("img").length).toBe(2));
		expect(wrapper.findAll("figure").length).toBe(2);
		expect(wrapper.text()).toContain("2 images");
		expect(wrapper.find("img").attributes("alt")).toBe("Preview of a.png");
		wrapper.unmount();
	});

	it("has a plus button and a text input, with a label on the input", () => {
		ImageDrop.handleDrop(["/shots/a.png"]);
		const wrapper = mountBar();
		expect(wrapper.find("button.add").attributes("aria-label")).toBe("Add images");
		expect(wrapper.find("textarea.text").attributes("aria-label")).toBe("Text to send with the images");
		wrapper.unmount();
	});

	it("puts the plus button first, before the pictures", () => {
		ImageDrop.handleDrop(["/shots/a.png", "/shots/b.png"]);
		const wrapper = mountBar();
		const children = [...wrapper.get(".thumbs").element.children];
		expect(children[0].classList.contains("add")).toBe(true);
		expect(children.slice(1).every((child) => child.tagName === "FIGURE")).toBe(true);
		wrapper.unmount();
	});

	it("opens the file picker with the plus button and adds the chosen images", async () => {
		ImageDrop.handleDrop(["/shots/a.png"]);
		openDialogMock.mockResolvedValue(["/shots/b.png"]);
		const wrapper = mountBar();
		await wrapper.find("button.add").trigger("click");
		await vi.waitFor(() => expect(compositionBar.paths).toEqual(["/shots/a.png", "/shots/b.png"]));
		wrapper.unmount();
	});

	it("opens the big view on the picture that is clicked", async () => {
		ImageDrop.handleDrop(["/shots/a.png", "/shots/b.png"]);
		const wrapper = mountBar();
		await wrapper.findAll("button.open")[1].trigger("click");
		expect(compositionBar.viewerIndex).toBe(1);
		wrapper.unmount();
	});

	it("removes one image with its small button, and stays open when the last image goes", async () => {
		ImageDrop.handleDrop(["/shots/a.png", "/shots/b.png"]);
		const wrapper = mountBar();
		await wrapper.find("button.remove").trigger("click");
		expect(compositionBar.paths).toEqual(["/shots/b.png"]);
		await wrapper.find("button.remove").trigger("click");
		expect(compositionBar.paths).toEqual([]);
		expect(compositionBar.isOpen).toBe(true);
		wrapper.unmount();
	});

	it("closes and empties everything with the button Close", async () => {
		ImageDrop.handleDrop(["/shots/a.png"]);
		compositionBar.text = "hello";
		const wrapper = mountBar();
		await findButton(wrapper, "Close")?.trigger("click");
		expect(compositionBar.paths).toEqual([]);
		expect(compositionBar.text).toBe("");
		expect(compositionBar.isOpen).toBe(false);
		wrapper.unmount();
	});

	it("closes with the key Escape", async () => {
		ImageDrop.handleDrop(["/shots/a.png"]);
		const wrapper = mountBar();
		await wrapper.find("textarea.text").trigger("keydown", { key: "Escape" });
		expect(compositionBar.isOpen).toBe(false);
		wrapper.unmount();
	});

	it("gives the keyboard to the text input, so that the developer types, then presses Enter", async () => {
		ImageDrop.handleDrop(["/shots/a.png"]);
		const wrapper = mountBar();
		await vi.waitFor(() => expect(document.activeElement).toBe(wrapper.find("textarea.text").element));
		wrapper.unmount();
	});

	it("pastes the images with the button Send, closes, and says that it sent, with no text written", async () => {
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register("pane-1", writer);
		ImageDrop.handleDrop(["/shots/a.png"]);
		const wrapper = mountBar();
		await findButton(wrapper, "Send")?.trigger("click");
		await vi.waitFor(() => expect(wrapper.emitted("sent")).toHaveLength(1));
		expect(invokeMock).toHaveBeenCalledWith("clipboard_set_image", { path: "/shots/a.png" });
		expect(writer).toHaveBeenCalledWith("\x16");
		expect(insertTextMock).not.toHaveBeenCalled();
		expect(compositionBar.paths).toEqual([]);
		expect(compositionBar.isOpen).toBe(false);
		ImageDrop.unregister("pane-1");
		wrapper.unmount();
	});

	it("sends with the key Enter in the text input, and writes the text with Enter after the images", async () => {
		vi.useFakeTimers();
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register("pane-1", writer);
		ImageDrop.handleDrop(["/shots/a.png"]);
		const wrapper = mountBar();
		await wrapper.find("textarea.text").setValue("  what is wrong here?  ");
		await wrapper.find("textarea.text").trigger("keydown", { key: "Enter" });
		await vi.advanceTimersByTimeAsync(600);
		expect(writer).toHaveBeenCalledWith("\x16");
		expect(insertTextMock).toHaveBeenCalledWith("pane-1", "what is wrong here?", true);
		expect(wrapper.emitted("sent")).toHaveLength(1);
		expect(compositionBar.text).toBe("");
		vi.useRealTimers();
		ImageDrop.unregister("pane-1");
		wrapper.unmount();
	});

	it("does not send with Shift+Enter, so that the text can have several lines", async () => {
		ImageDrop.handleDrop(["/shots/a.png"]);
		const wrapper = mountBar();
		await wrapper.find("textarea.text").setValue("first line\nsecond line");
		await wrapper.find("textarea.text").trigger("keydown", { key: "Enter", shiftKey: true });
		expect(wrapper.emitted("sent")).toBeUndefined();
		expect(compositionBar.isOpen).toBe(true);
		expect(compositionBar.text).toBe("first line\nsecond line");
		wrapper.unmount();
	});

	it("sends a text of several lines whole, with its line breaks", async () => {
		vi.useFakeTimers();
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register("pane-1", writer);
		ImageDrop.handleDrop(["/shots/a.png"]);
		const wrapper = mountBar();
		await wrapper.find("textarea.text").setValue("first line\n\nsecond line");
		await wrapper.find("textarea.text").trigger("keydown", { key: "Enter" });
		await vi.advanceTimersByTimeAsync(600);
		expect(insertTextMock).toHaveBeenCalledWith("pane-1", "first line\n\nsecond line", true);
		vi.useRealTimers();
		ImageDrop.unregister("pane-1");
		wrapper.unmount();
	});

	it("keeps the images that were not pasted, and the text, when a paste fails", async () => {
		const writer = vi.fn().mockResolvedValue(undefined);
		ImageDrop.register("pane-1", writer);
		ImageDrop.handleDrop(["/shots/a.png"]);
		compositionBar.text = "keep me";
		const wrapper = mountBar();
		invokeMock.mockReset();
		invokeMock.mockRejectedValue("boom");
		await findButton(wrapper, "Send")?.trigger("click");
		await vi.waitFor(() => expect(invokeMock).toHaveBeenCalled());
		expect(wrapper.emitted("sent")).toBeUndefined();
		expect(insertTextMock).not.toHaveBeenCalled();
		expect(compositionBar.paths).toEqual(["/shots/a.png"]);
		expect(compositionBar.text).toBe("keep me");
		expect(compositionBar.isOpen).toBe(true);
		ImageDrop.unregister("pane-1");
		wrapper.unmount();
	});
});
