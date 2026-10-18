import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));
/** The functions that the web page gave to `listen`, by event name: the library listens once in the life of the module. */
const handlers: Record<string, ((event: { payload: unknown }) => void) | undefined> = {};
const listenMock = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
	handlers[name] = handler;
	return () => {};
});
vi.mock("@tauri-apps/api/event", () => ({
	listen: (...args: Parameters<typeof listenMock>) => listenMock(...args),
}));

import { LONG_PRESS_MILLISECONDS, VoiceInput } from "./voice_input";
import { compositionBar } from "../stores/composition_bar";
import { settings } from "../stores/settings";
import { LEVEL_COUNT, voiceInput, type VoiceOptions } from "../stores/voice_input";

/** The options that the desktop application gives: the model `base` is on the disk, and the model `tiny` is not. */
function makeOptions(): VoiceOptions {
	return {
		models: [
			{ id: "tiny", sizeBytes: 77_691_713, isEnglishOnly: false, isDownloaded: false },
			{ id: "base", sizeBytes: 147_951_465, isEnglishOnly: false, isDownloaded: true },
		],
		languages: ["en", "fr"],
		defaultModelId: "base",
	};
}

/** The names of the commands that the web page sent to the desktop application, in order. */
function commandNames(): string[] {
	return invokeMock.mock.calls.map((call) => call[0] as string);
}

/** Lets the time pass for the code that measures the length of a press, without any real waiting. */
function passTime(milliseconds: number): void {
	vi.setSystemTime(Date.now() + milliseconds);
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	invokeMock.mockReset();
	listenMock.mockClear();
	settings.voiceInput = true;
	settings.voiceInputModel = "base";
	settings.voiceInputLanguage = "auto";
	voiceInput.options = makeOptions();
	voiceInput.state = "idle";
	voiceInput.isLatched = false;
	voiceInput.levels = [];
	voiceInput.error = null;
	voiceInput.download = { modelId: null, receivedBytes: 0, totalBytes: 0, error: null };
	compositionBar.isOpen = false;
	compositionBar.text = "";
	compositionBar.paths = [];
});

afterEach(async () => {
	await VoiceInput.cancel();
	vi.useRealTimers();
});

describe("VoiceInput.loadOptions", () => {
	it("reads the options of the desktop application, and listens once to the progress of the downloads", async () => {
		voiceInput.options = null;
		invokeMock.mockResolvedValue(makeOptions());
		await VoiceInput.loadOptions();
		await VoiceInput.loadOptions();
		expect((voiceInput.options as VoiceOptions | null)?.models.length).toBe(2);
		expect(commandNames()).toEqual(["voice_options", "voice_options"]);
		const progressListens = listenMock.mock.calls.filter((call) => call[0] === "voice-download-progress");
		expect(progressListens.length).toBeLessThanOrEqual(1);
	});

	it("keeps the options when the desktop application gives nothing", async () => {
		invokeMock.mockResolvedValue(null);
		await VoiceInput.loadOptions();
		expect(voiceInput.options?.models.length).toBe(2);
	});
});

describe("the model", () => {
	it("is the model that the developer chose, with its state on the disk", () => {
		expect(VoiceInput.chosenModel()?.id).toBe("base");
		expect(VoiceInput.isModelReady()).toBe(true);
		settings.voiceInputModel = "tiny";
		expect(VoiceInput.isModelReady()).toBe(false);
		settings.voiceInputModel = "no_such_model";
		expect(VoiceInput.chosenModel()).toBeNull();
		expect(VoiceInput.isModelReady()).toBe(false);
	});

	it("is not ready before the options are read", () => {
		voiceInput.options = null;
		expect(VoiceInput.isModelReady()).toBe(false);
	});

	it("gives the progress of the download of the chosen model as a whole percent", () => {
		expect(VoiceInput.downloadPercent()).toBeNull();
		voiceInput.download = { modelId: "base", receivedBytes: 345, totalBytes: 1000, error: null };
		expect(VoiceInput.downloadPercent()).toBe(34);
		voiceInput.download = { modelId: "tiny", receivedBytes: 500, totalBytes: 1000, error: null };
		expect(VoiceInput.downloadPercent()).toBeNull();
	});
});

describe("VoiceInput.downloadModel", () => {
	it("downloads a model, then reads the options again", async () => {
		invokeMock.mockResolvedValue(makeOptions());
		await VoiceInput.downloadModel("tiny");
		expect(invokeMock.mock.calls[0]).toEqual(["voice_download_model", { modelId: "tiny" }]);
		expect(commandNames()).toEqual(["voice_download_model", "voice_options"]);
		expect(voiceInput.download.modelId).toBeNull();
		expect(voiceInput.download.error).toBeNull();
	});

	it("keeps the category of a failure, and frees the download for a new try", async () => {
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_download_model") {
				throw "download_failed";
			}
			return makeOptions();
		});
		await VoiceInput.downloadModel("tiny");
		expect(voiceInput.download.error).toBe("download_failed");
		expect(voiceInput.download.modelId).toBeNull();
	});

	it("clears the last error when a new try begins", async () => {
		voiceInput.download.error = "download_failed";
		invokeMock.mockResolvedValue(makeOptions());
		await VoiceInput.downloadModel("tiny");
		expect(voiceInput.download.error).toBeNull();
	});

	it("starts nothing while another model downloads", async () => {
		voiceInput.download.modelId = "base";
		await VoiceInput.downloadModel("tiny");
		expect(invokeMock).not.toHaveBeenCalled();
	});

	it("shows the progress that the desktop application sends", async () => {
		invokeMock.mockResolvedValue(makeOptions());
		voiceInput.options = null;
		await VoiceInput.loadOptions();
		expect(handlers["voice-download-progress"]).toBeDefined();
		handlers["voice-download-progress"]?.({ payload: { modelId: "tiny", receivedBytes: 10, totalBytes: 40 } });
		expect(voiceInput.download).toMatchObject({ modelId: "tiny", receivedBytes: 10, totalBytes: 40 });
	});
});

describe("VoiceInput.ensureChosenModel", () => {
	it("downloads the chosen model when it is not on the disk", async () => {
		settings.voiceInputModel = "tiny";
		invokeMock.mockResolvedValue(makeOptions());
		await VoiceInput.ensureChosenModel();
		expect(invokeMock.mock.calls[0]).toEqual(["voice_download_model", { modelId: "tiny" }]);
	});

	it("downloads nothing when the model is on the disk", async () => {
		await VoiceInput.ensureChosenModel();
		expect(invokeMock).not.toHaveBeenCalled();
	});

	it("downloads nothing when the option is off", async () => {
		settings.voiceInput = false;
		settings.voiceInputModel = "tiny";
		await VoiceInput.ensureChosenModel();
		expect(invokeMock).not.toHaveBeenCalled();
	});
});

describe("VoiceInput.press and VoiceInput.release: a long press", () => {
	it("opens the composition bar, records while the button is held, and writes the text after the release", async () => {
		invokeMock.mockImplementation(async (name: string) => (name === "voice_stop_recording" ? "Run the tests again." : undefined));
		await VoiceInput.press();
		expect(voiceInput.state).toBe("recording");
		expect(voiceInput.isLatched).toBe(false);
		expect(compositionBar.isOpen).toBe(true);
		passTime(LONG_PRESS_MILLISECONDS + 100);
		await VoiceInput.release();
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording"]);
		expect(invokeMock.mock.calls[1][1]).toEqual({ modelId: "base", language: "auto" });
		expect(compositionBar.text).toBe("Run the tests again.");
		expect(voiceInput.state).toBe("idle");
		expect(voiceInput.error).toBeNull();
	});

	it("gives the model and the language that the developer chose", async () => {
		settings.voiceInputLanguage = "fr";
		invokeMock.mockResolvedValue("");
		await VoiceInput.press();
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release();
		expect(invokeMock.mock.calls[1][1]).toEqual({ modelId: "base", language: "fr" });
	});

	it("ends when the pointer is released anywhere in the window", async () => {
		invokeMock.mockImplementation(async (name: string) => (name === "voice_stop_recording" ? "Hello" : undefined));
		await VoiceInput.press();
		passTime(LONG_PRESS_MILLISECONDS + 100);
		window.dispatchEvent(new Event("pointerup"));
		await vi.waitFor(() => expect(compositionBar.text).toBe("Hello"));
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording"]);
	});

	it("stops at once when the button is released before the microphone is open", async () => {
		let openMicrophone: () => void = () => {};
		invokeMock.mockImplementation((name: string) => {
			if (name === "voice_start_recording") {
				return new Promise<void>((resolve) => {
					openMicrophone = resolve;
				});
			}
			return Promise.resolve("Quick words");
		});
		const starting = VoiceInput.press();
		expect(voiceInput.state).toBe("starting");
		passTime(LONG_PRESS_MILLISECONDS + 100);
		await VoiceInput.release();
		openMicrophone();
		await starting;
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording"]);
		expect(compositionBar.text).toBe("Quick words");
		expect(voiceInput.state).toBe("idle");
	});

	it("adds the text after the text that the developer already wrote, with one space", async () => {
		compositionBar.text = "Please";
		invokeMock.mockImplementation(async (name: string) => (name === "voice_stop_recording" ? "  run the tests " : undefined));
		await VoiceInput.press();
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release();
		expect(compositionBar.text).toBe("Please run the tests");
	});

	it("writes no error and no text for a recording with no speech", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press();
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release();
		expect(compositionBar.text).toBe("");
		expect(voiceInput.error).toBeNull();
		expect(voiceInput.state).toBe("idle");
	});

	it("keeps the category of the error when the speech cannot change into text", async () => {
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_stop_recording") {
				throw "no_signal";
			}
			return undefined;
		});
		await VoiceInput.press();
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release();
		expect(voiceInput.error).toBe("no_signal");
		expect(voiceInput.state).toBe("idle");
	});

	it("drops the text when the composition bar was closed during the change", async () => {
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_stop_recording") {
				compositionBar.isOpen = false;
				return "Too late";
			}
			return undefined;
		});
		await VoiceInput.press();
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release();
		expect(compositionBar.text).toBe("");
	});
});

describe("VoiceInput.press and VoiceInput.release: a click", () => {
	it("keeps the recording after a short press, until the next press", async () => {
		invokeMock.mockImplementation(async (name: string) => (name === "voice_stop_recording" ? "Keep going" : undefined));
		await VoiceInput.press();
		passTime(LONG_PRESS_MILLISECONDS - 100);
		await VoiceInput.release();
		expect(voiceInput.state).toBe("recording");
		expect(voiceInput.isLatched).toBe(true);
		expect(commandNames()).toEqual(["voice_start_recording"]);
		await VoiceInput.press();
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording"]);
		expect(compositionBar.text).toBe("Keep going");
		expect(voiceInput.state).toBe("idle");
		expect(voiceInput.isLatched).toBe(false);
	});

	it("keeps the recording when the pointer is released at once anywhere in the window", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press();
		window.dispatchEvent(new Event("pointerup"));
		await vi.waitFor(() => expect(voiceInput.isLatched).toBe(true));
		expect(voiceInput.state).toBe("recording");
	});

	it("ignores the release of the pointer and the loss of the keyboard while the recording is kept", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press();
		await VoiceInput.release();
		window.dispatchEvent(new Event("pointerup"));
		window.dispatchEvent(new Event("pointercancel"));
		window.dispatchEvent(new Event("blur"));
		await Promise.resolve();
		expect(voiceInput.state).toBe("recording");
		expect(commandNames()).toEqual(["voice_start_recording"]);
	});

	it("stops a short press at once when the window loses the keyboard", async () => {
		invokeMock.mockImplementation(async (name: string) => (name === "voice_stop_recording" ? "Hello" : undefined));
		await VoiceInput.press();
		window.dispatchEvent(new Event("blur"));
		await vi.waitFor(() => expect(compositionBar.text).toBe("Hello"));
		expect(voiceInput.isLatched).toBe(false);
	});

	it("keeps the recording when a short press ends before the microphone is open", async () => {
		let openMicrophone: () => void = () => {};
		invokeMock.mockImplementation((name: string) => {
			if (name === "voice_start_recording") {
				return new Promise<void>((resolve) => {
					openMicrophone = resolve;
				});
			}
			return Promise.resolve("Later words");
		});
		const starting = VoiceInput.press();
		await VoiceInput.release();
		openMicrophone();
		await starting;
		expect(voiceInput.state).toBe("recording");
		expect(voiceInput.isLatched).toBe(true);
		expect(commandNames()).toEqual(["voice_start_recording"]);
		await VoiceInput.press();
		expect(compositionBar.text).toBe("Later words");
	});

	it("does nothing with a press while Whisper changes the speech into text", async () => {
		voiceInput.state = "transcribing";
		await VoiceInput.press();
		expect(invokeMock).not.toHaveBeenCalled();
		expect(voiceInput.state).toBe("transcribing");
	});
});

describe("VoiceInput.press and VoiceInput.release: when nothing can record", () => {
	it("keeps the category of the error when macOS refuses the microphone, and records nothing", async () => {
		invokeMock.mockRejectedValue("microphone_denied");
		await VoiceInput.press();
		expect(voiceInput.error).toBe("microphone_denied");
		expect(voiceInput.state).toBe("idle");
		expect(voiceInput.isLatched).toBe(false);
		await VoiceInput.release();
		expect(commandNames()).toEqual(["voice_start_recording"]);
	});

	it("does not open the microphone when the option is off", async () => {
		settings.voiceInput = false;
		await VoiceInput.press();
		expect(invokeMock).not.toHaveBeenCalled();
		expect(voiceInput.state).toBe("idle");
		expect(compositionBar.isOpen).toBe(false);
	});

	it("does not open the microphone when the model is not on the disk", async () => {
		settings.voiceInputModel = "tiny";
		await VoiceInput.press();
		expect(invokeMock).not.toHaveBeenCalled();
		expect(voiceInput.error).toBe("model_missing");
		expect(compositionBar.isOpen).toBe(false);
	});

	it("starts one recording at a time", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press();
		await VoiceInput.press();
		expect(commandNames()).toEqual(["voice_start_recording"]);
	});

	it("ignores a release when nothing records", async () => {
		await VoiceInput.release();
		expect(invokeMock).not.toHaveBeenCalled();
	});
});

describe("the level of the voice", () => {
	/** Sends one level, as the desktop application does. */
	function sendLevel(level: number): void {
		handlers["voice-input-level"]?.({ payload: level });
	}

	it("listens once to the event of the level, and keeps the levels of the recording", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press();
		await VoiceInput.release();
		sendLevel(0.2);
		sendLevel(0.7);
		expect(voiceInput.levels).toEqual([0.2, 0.7]);
		await VoiceInput.press();
		await VoiceInput.press();
		await VoiceInput.release();
		const levelListens = listenMock.mock.calls.filter((call) => call[0] === "voice-input-level");
		expect(levelListens.length).toBeLessThanOrEqual(1);
	});

	it("keeps only the last levels", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press();
		for (let level = 0; level < LEVEL_COUNT + 10; level += 1) {
			sendLevel(level / 100);
		}
		expect(voiceInput.levels.length).toBe(LEVEL_COUNT);
		expect(voiceInput.levels[LEVEL_COUNT - 1]).toBe((LEVEL_COUNT + 9) / 100);
	});

	it("ignores a level that arrives when nothing records", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press();
		await VoiceInput.release();
		await VoiceInput.press();
		sendLevel(0.5);
		expect(voiceInput.levels).toEqual([]);
	});

	it("starts a new recording with no level from the old recording", async () => {
		invokeMock.mockResolvedValue("");
		await VoiceInput.press();
		sendLevel(0.5);
		passTime(LONG_PRESS_MILLISECONDS);
		await VoiceInput.release();
		await VoiceInput.press();
		expect(voiceInput.levels).toEqual([]);
	});
});

describe("VoiceInput.settle", () => {
	it("returns at once when nothing records", async () => {
		expect(await VoiceInput.settle()).toBe(true);
		expect(invokeMock).not.toHaveBeenCalled();
	});

	it("stops a recording of a long press, writes its text, and returns true", async () => {
		invokeMock.mockImplementation(async (name: string) => (name === "voice_stop_recording" ? "Spoken words" : undefined));
		await VoiceInput.press();
		passTime(LONG_PRESS_MILLISECONDS + 100);
		expect(await VoiceInput.settle()).toBe(true);
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording"]);
		expect(compositionBar.text).toBe("Spoken words");
		expect(voiceInput.state).toBe("idle");
		expect(voiceInput.isLatched).toBe(false);
	});

	it("stops a recording that a click keeps, writes its text, and returns true", async () => {
		invokeMock.mockImplementation(async (name: string) => (name === "voice_stop_recording" ? "Kept words" : undefined));
		await VoiceInput.press();
		await VoiceInput.release();
		expect(voiceInput.isLatched).toBe(true);
		expect(await VoiceInput.settle()).toBe(true);
		expect(compositionBar.text).toBe("Kept words");
		expect(voiceInput.state).toBe("idle");
		expect(voiceInput.isLatched).toBe(false);
	});

	it("waits for the microphone to open, then stops, and returns true", async () => {
		let openMicrophone: () => void = () => {};
		invokeMock.mockImplementation((name: string) => {
			if (name === "voice_start_recording") {
				return new Promise<void>((resolve) => {
					openMicrophone = resolve;
				});
			}
			return Promise.resolve("Late words");
		});
		const starting = VoiceInput.press();
		expect(voiceInput.state).toBe("starting");
		const settling = VoiceInput.settle();
		await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("voice_start_recording"));
		openMicrophone();
		expect(await settling).toBe(true);
		await starting;
		expect(commandNames()).toEqual(["voice_start_recording", "voice_stop_recording"]);
		expect(compositionBar.text).toBe("Late words");
		expect(voiceInput.state).toBe("idle");
	});

	it("waits for the speech that already changes into text, and returns true", async () => {
		let giveText: (text: string) => void = () => {};
		invokeMock.mockImplementation((name: string) => {
			if (name === "voice_stop_recording") {
				return new Promise<string>((resolve) => {
					giveText = resolve;
				});
			}
			return Promise.resolve(undefined);
		});
		await VoiceInput.press();
		passTime(LONG_PRESS_MILLISECONDS + 100);
		const releasing = VoiceInput.release();
		expect(voiceInput.state).toBe("transcribing");
		let isSettled = false;
		const settling = VoiceInput.settle().then((result) => {
			isSettled = result;
		});
		await Promise.resolve();
		expect(isSettled).toBe(false);
		giveText("Waited words");
		await settling;
		await releasing;
		expect(isSettled).toBe(true);
		expect(compositionBar.text).toBe("Waited words");
		expect(commandNames().filter((name) => name === "voice_stop_recording").length).toBe(1);
	});

	it("returns false and keeps the category when the speech cannot change into text", async () => {
		invokeMock.mockImplementation(async (name: string) => {
			if (name === "voice_stop_recording") {
				throw "no_signal";
			}
			return undefined;
		});
		await VoiceInput.press();
		passTime(LONG_PRESS_MILLISECONDS + 100);
		expect(await VoiceInput.settle()).toBe(false);
		expect(voiceInput.error).toBe("no_signal");
		expect(voiceInput.state).toBe("idle");
	});

	it("returns false and keeps the category when the microphone cannot open", async () => {
		invokeMock.mockImplementation((name: string) =>
			name === "voice_start_recording" ? Promise.reject("microphone_denied") : Promise.resolve(undefined),
		);
		const starting = VoiceInput.press();
		expect(await VoiceInput.settle()).toBe(false);
		await starting;
		expect(voiceInput.error).toBe("microphone_denied");
		expect(voiceInput.state).toBe("idle");
	});

	it("forgets the error of an earlier recording when a new recording ends well", async () => {
		invokeMock.mockImplementation(async (name: string) => (name === "voice_stop_recording" ? "Fine" : undefined));
		await VoiceInput.press();
		voiceInput.error = "no_signal";
		passTime(LONG_PRESS_MILLISECONDS + 100);
		expect(await VoiceInput.settle()).toBe(true);
		expect(voiceInput.error).toBeNull();
	});
});

describe("VoiceInput.cancel", () => {
	it("throws away a recording that runs", async () => {
		invokeMock.mockResolvedValue(undefined);
		await VoiceInput.press();
		await VoiceInput.cancel();
		expect(commandNames()).toEqual(["voice_start_recording", "voice_cancel_recording"]);
		expect(voiceInput.state).toBe("idle");
	});

	it("does nothing when nothing records", async () => {
		await VoiceInput.cancel();
		expect(invokeMock).not.toHaveBeenCalled();
	});
});
