import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import PushToTalkButton from "./PushToTalkButton.vue";
import { LONG_PRESS_MILLISECONDS, VoiceInput } from "../lib/voice_input";
import { compositionBar } from "../stores/composition_bar";
import { settings } from "../stores/settings";
import { voiceInput } from "../stores/voice_input";

/** Lets the time pass for the code that measures the length of a press, without any real waiting. */
function passTime(milliseconds: number): void {
	vi.setSystemTime(Date.now() + milliseconds);
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	invokeMock.mockReset();
	invokeMock.mockImplementation(async (name: string) => (name === "voice_stop_recording" ? "Hello" : undefined));
	settings.voiceInput = true;
	settings.voiceInputModel = "base";
	settings.voiceInputLanguage = "auto";
	voiceInput.options = {
		models: [
			{ id: "tiny", sizeBytes: 77_691_713, isEnglishOnly: false, isDownloaded: false },
			{ id: "base", sizeBytes: 147_951_465, isEnglishOnly: false, isDownloaded: true },
		],
		languages: ["en"],
		defaultModelId: "base",
	};
	voiceInput.state = "idle";
	voiceInput.isLatched = false;
	voiceInput.levels = [];
	voiceInput.error = null;
	compositionBar.isOpen = true;
	compositionBar.text = "";
});

afterEach(async () => {
	await VoiceInput.cancel();
	vi.useRealTimers();
});

describe("PushToTalkButton", () => {
	it("has a name for the screen reader and a title that tells to hold the button or to click it", () => {
		const wrapper = mount(PushToTalkButton);
		expect(wrapper.attributes("aria-label")).toBe("Push to talk");
		expect(wrapper.attributes("title")).toBe(
			"Hold to speak, and release to write the text. Or click to start, and click again to write the text.",
		);
		expect(wrapper.attributes("aria-pressed")).toBe("false");
		expect(wrapper.find(".bi-mic").exists()).toBe(true);
		wrapper.unmount();
	});

	it("is red only while the microphone is open", () => {
		const wrapper = mount(PushToTalkButton);
		expect(wrapper.classes()).not.toContain("is-recording");
		voiceInput.state = "recording";
		return wrapper.vm.$nextTick().then(() => {
			expect(wrapper.classes()).toContain("is-recording");
			voiceInput.state = "idle";
			wrapper.unmount();
		});
	});

	it("is a Bootstrap button with no border, and not a small tool button of the header of a pane", () => {
		const wrapper = mount(PushToTalkButton);
		expect(wrapper.classes()).toContain("btn");
		expect(wrapper.classes()).toContain("border-0");
		expect(wrapper.classes()).not.toContain("tool");
		wrapper.unmount();
	});

	it("records while the pointer is down for a long press, and writes the text when the pointer is released", async () => {
		const wrapper = mount(PushToTalkButton, { attachTo: document.body });
		await wrapper.trigger("pointerdown", { button: 0 });
		await vi.waitFor(() => expect(voiceInput.state).toBe("recording"));
		await wrapper.vm.$nextTick();
		expect(wrapper.attributes("aria-pressed")).toBe("true");
		expect(wrapper.find(".bi-mic-fill").exists()).toBe(true);
		expect(wrapper.classes()).toContain("is-recording");
		expect(wrapper.attributes("title")).toBe("Listening… release the button to write the text");
		passTime(LONG_PRESS_MILLISECONDS + 100);
		window.dispatchEvent(new Event("pointerup"));
		await vi.waitFor(() => expect(compositionBar.text).toBe("Hello"));
		expect(invokeMock.mock.calls.map((call) => call[0])).toEqual(["voice_start_recording", "voice_stop_recording"]);
		wrapper.unmount();
	});

	it("keeps recording after a click, shows a stop icon, and writes the text at the next click", async () => {
		const wrapper = mount(PushToTalkButton, { attachTo: document.body });
		await wrapper.trigger("pointerdown", { button: 0 });
		await vi.waitFor(() => expect(voiceInput.state).toBe("recording"));
		window.dispatchEvent(new Event("pointerup"));
		await vi.waitFor(() => expect(voiceInput.isLatched).toBe(true));
		await wrapper.vm.$nextTick();
		expect(wrapper.attributes("aria-pressed")).toBe("true");
		expect(wrapper.find(".bi-stop-fill").exists()).toBe(true);
		expect(wrapper.classes()).toContain("is-recording");
		expect(wrapper.attributes("title")).toBe("Listening… click the button again to write the text");
		window.dispatchEvent(new Event("blur"));
		expect(voiceInput.state).toBe("recording");
		await wrapper.trigger("pointerdown", { button: 0 });
		await vi.waitFor(() => expect(compositionBar.text).toBe("Hello"));
		expect(invokeMock.mock.calls.map((call) => call[0])).toEqual(["voice_start_recording", "voice_stop_recording"]);
		expect(voiceInput.isLatched).toBe(false);
		wrapper.unmount();
	});

	it("ignores a click of another mouse button", async () => {
		const wrapper = mount(PushToTalkButton);
		await wrapper.trigger("pointerdown", { button: 2 });
		expect(invokeMock).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it("is held with the key Space and released with the same key, and the repeat of the key starts nothing", async () => {
		const wrapper = mount(PushToTalkButton, { attachTo: document.body });
		await wrapper.trigger("keydown", { key: " " });
		await wrapper.trigger("keydown", { key: " ", repeat: true });
		await vi.waitFor(() => expect(voiceInput.state).toBe("recording"));
		passTime(LONG_PRESS_MILLISECONDS + 100);
		await wrapper.trigger("keyup", { key: " " });
		await vi.waitFor(() => expect(compositionBar.text).toBe("Hello"));
		expect(invokeMock.mock.calls.filter((call) => call[0] === "voice_start_recording").length).toBe(1);
		wrapper.unmount();
	});

	it("is disabled, with a title that says where to download the model, when the model is not on the disk", async () => {
		settings.voiceInputModel = "tiny";
		const wrapper = mount(PushToTalkButton);
		expect(wrapper.attributes("disabled")).toBeDefined();
		expect(wrapper.attributes("title")).toBe("The Whisper model is not on this computer. Open Settings, Voice input, to download it.");
		wrapper.unmount();
	});

	it("shows a spinner and is disabled while the speech changes into text", async () => {
		voiceInput.state = "transcribing";
		const wrapper = mount(PushToTalkButton);
		expect(wrapper.find(".spinner-border").exists()).toBe(true);
		expect(wrapper.classes()).toContain("is-transcribing");
		expect(wrapper.classes()).not.toContain("is-recording");
		expect(wrapper.attributes("disabled")).toBeDefined();
		expect(wrapper.attributes("title")).toBe("Changing the speech into text…");
		wrapper.unmount();
	});

	it("reads the options of the desktop application when it appears and nothing was read", async () => {
		voiceInput.options = null;
		invokeMock.mockResolvedValue(null);
		const wrapper = mount(PushToTalkButton);
		await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("voice_options"));
		wrapper.unmount();
	});
});
