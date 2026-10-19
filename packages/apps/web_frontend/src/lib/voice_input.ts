import { invoke } from "@tauri-apps/api/core";
import { watch } from "vue";
import { listen } from "@tauri-apps/api/event";
import { CompositionBar } from '../stores/composition_bar';
import { settings } from "../stores/settings";
import { LEVEL_COUNT, voiceInput, type VoiceModel, type VoiceOptions } from "../stores/voice_input";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	VoiceInput — the push-to-talk button (long press, or click to start and click to stop), and the Whisper model (issue 662)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The name of the event with which the desktop application tells how far a download went. */
const DOWNLOAD_PROGRESS_EVENT = "voice-download-progress";

/** The name of the event with which the desktop application tells the level of the voice, 20 times a second. */
const LEVEL_EVENT = "voice-input-level";

/** A press that lasts less than this, in milliseconds, is a click: the recording goes on until the next press. */
export const LONG_PRESS_MILLISECONDS = 300;

/** The payload of the event of the progress of a download. */
type DownloadProgressPayload = {
	/** The model that downloads. */
	modelId: string;
	/** The bytes written so far. */
	receivedBytes: number;
	/** The size of the file. */
	totalBytes: number;
};

export class VoiceInput {
	/** Changes whenever a recording starts or is cancelled, so late results cannot affect another recording. */
	private static operationId = 0;

	/** The microphone command that must finish before a cancellation can discard its recorder. */
	private static starting: Promise<void> | null = null;

	/** The cancellation that must finish before another recording can open the microphone. */
	private static cancelling: Promise<void> | null = null;

	/** True after the web page began to listen to the events of the progress of a download. */
	private static isListening = false;

	/** True after the web page began to listen to the events of the level of the voice. */
	private static isListeningToLevels = false;

	/** The moment of the last press of the button, in milliseconds. */
	private static pressedAt = 0;

	/** What the developer did with the button before the microphone was open: nothing, a short press, or a long press. */
	private static pendingRelease: "none" | "keep" | "stop" = "none";

	/**
	 * Returns the pane whose composition bar owns the current or most recent recording.
	 * @returns The identifier of the pane, or null before a recording starts.
	 */
	static ownerPaneId(): string | null {
		return voiceInput.ownerPaneId;
	}

	/**
	 * Reads the options of the desktop application, and listens to the progress of the downloads. It reads a list of files
	 * and opens no microphone.
	 */
	static async loadOptions(): Promise<void> {
		if (VoiceInput.isListening === false) {
			VoiceInput.isListening = true;
			await listen<DownloadProgressPayload>(DOWNLOAD_PROGRESS_EVENT, (event) => {
				voiceInput.download.modelId = event.payload.modelId;
				voiceInput.download.receivedBytes = event.payload.receivedBytes;
				voiceInput.download.totalBytes = event.payload.totalBytes;
			});
		}
		const options = await invoke<VoiceOptions | null>("voice_options");
		if (options !== null && options !== undefined) {
			voiceInput.options = options;
		}
	}

	/**
	 * The model that the developer chose, with its state on the disk.
	 * @returns The model, or null before the options are read.
	 */
	static chosenModel(): VoiceModel | null {
		const models = voiceInput.options?.models ?? [];
		return models.find((model) => model.id === settings.voiceInputModel) ?? null;
	}

	/**
	 * The chosen model is on the disk, so a recording can change into text.
	 * @returns True when the push-to-talk button can work.
	 */
	static isModelReady(): boolean {
		return VoiceInput.chosenModel()?.isDownloaded === true;
	}

	/**
	 * The progress of the download of the chosen model.
	 * @returns A whole number from 0 to 100, or null when the chosen model does not download.
	 */
	static downloadPercent(): number | null {
		const download = voiceInput.download;
		if (download.modelId === null || download.modelId !== settings.voiceInputModel || download.totalBytes === 0) {
			return null;
		}
		return Math.min(100, Math.floor((download.receivedBytes / download.totalBytes) * 100));
	}

	/**
	 * Downloads a model. The progress is in `voiceInput.download`. A failure keeps its category in `voiceInput.download.error`.
	 * @param modelId The identifier of the model.
	 */
	static async downloadModel(modelId: string): Promise<void> {
		if (voiceInput.download.modelId !== null) {
			return;
		}
		voiceInput.download.modelId = modelId;
		voiceInput.download.receivedBytes = 0;
		voiceInput.download.totalBytes = 0;
		voiceInput.download.error = null;
		try {
			await invoke("voice_download_model", { modelId });
		} catch (error) {
			voiceInput.download.error = String(error);
		}
		voiceInput.download.modelId = null;
		try {
			await VoiceInput.loadOptions();
		} catch {
			// The state of the files stays as it was.
		}
	}

	/** Downloads the chosen model when it is not on the disk and does not download now. */
	static async ensureChosenModel(): Promise<void> {
		if (settings.voiceInput === false || voiceInput.options === null) {
			return;
		}
		const model = VoiceInput.chosenModel();
		if (model === null || model.isDownloaded === true || voiceInput.download.modelId !== null) {
			return;
		}
		await VoiceInput.downloadModel(model.id);
	}

	/**
	 * The developer presses the push-to-talk button in a pane's composition bar. The microphone records for that pane.
	 * With a recording that a click started, this press stops it and writes the text. Nothing happens when the option is off,
	 * when the model is not on the disk, or while Whisper works.
	 * @param paneId The identifier of the pane whose push-to-talk button was pressed.
	 * @returns Resolves when the press has started or stopped a recording.
	 */
	static async press(paneId: string): Promise<void> {
		if (voiceInput.state === "recording" && voiceInput.isLatched === true) {
			if (voiceInput.ownerPaneId !== paneId) {
				return;
			}
			await VoiceInput.stopAndWrite();
			return;
		}
		await VoiceInput.startRecording(paneId);
	}

	/**
	 * The developer releases the push-to-talk button. After a long press, this is the end of the push to talk: the recording stops
	 * and the text is written. After a short press, which is a click, the recording goes on until the next press.
	 * @param isForced True when the window lost the keyboard: the recording then stops, whatever the length of the press.
	 * @param paneId The identifier of the pane whose button was released, or undefined for a window release event.
	 * @returns Resolves when the release has been handled.
	 */
	static async release(isForced = false, paneId?: string): Promise<void> {
		if (paneId !== undefined && voiceInput.ownerPaneId !== paneId) {
			return;
		}
		const isShort = isForced === false && Date.now() - VoiceInput.pressedAt < LONG_PRESS_MILLISECONDS;
		if (voiceInput.state === "starting") {
			VoiceInput.pendingRelease = isShort ? "keep" : "stop";
			return;
		}
		if (voiceInput.state !== "recording" || voiceInput.isLatched === true) {
			return;
		}
		if (isShort) {
			VoiceInput.keepRecording();
			return;
		}
		await VoiceInput.stopAndWrite();
	}

	/**
	 * Stops the recording and writes the text: Whisper changes the speech into text, and the text goes at the end of the text of
	 * the composition bar. A recording with no speech adds nothing and shows no error.
	 * @returns Resolves after the recording has stopped and the text has been written or an error has been saved.
	 */
	static async stopAndWrite(): Promise<void> {
		if (voiceInput.state !== "recording") {
			return;
		}
		const operationId = VoiceInput.operationId;
		VoiceInput.stopListeningToRelease();
		voiceInput.isLatched = false;
		voiceInput.state = "transcribing";
		try {
			const text = await invoke<string>("voice_stop_recording", {
				modelId: settings.voiceInputModel,
				language: settings.voiceInputLanguage,
			});
			if (operationId !== VoiceInput.operationId) {
				return;
			}
			VoiceInput.appendToCompositionBar(text);
			voiceInput.error = null;
		} catch (error) {
			if (operationId !== VoiceInput.operationId) {
				return;
			}
			voiceInput.error = String(error);
		}
		voiceInput.state = "idle";
	}

	/**
	 * Makes sure that no recording runs and no speech waits to change into text. A recording that runs stops, Whisper changes the
	 * speech into text, and the text goes in the composition bar. The button "Send" calls this first, so that the text of the speech
	 * goes with the message.
	 * @param paneId The identifier of the pane whose message is being sent.
	 * @returns True when nothing was running, or when the recording ended well. False when the recording or the change into text
	 * failed: the category of the error is in `voiceInput.error`.
	 */
	static async settle(paneId: string): Promise<boolean> {
		if (voiceInput.ownerPaneId !== paneId) {
			return true;
		}
		if (voiceInput.state === "idle") {
			return true;
		}
		const operationId = VoiceInput.operationId;
		voiceInput.error = null;
		if (voiceInput.state === "starting") {
			VoiceInput.pendingRelease = "stop";
		} else if (voiceInput.state === "recording") {
			void VoiceInput.stopAndWrite();
		}
		await VoiceInput.waitForIdle();
		return operationId === VoiceInput.operationId && voiceInput.error === null;
	}

	/**
	 * Cancels recording or transcription without changing the draft. Late text and errors are discarded.
	 * @param paneId The pane that owns the operation, or undefined to cancel any operation.
	 * @returns Resolves after the microphone has been released for another recording.
	 */
	static async cancel(paneId?: string): Promise<void> {
		if (paneId !== undefined && voiceInput.ownerPaneId !== paneId) {
			return;
		}
		if (voiceInput.state === 'idle') {
			await VoiceInput.cancelling;
			return;
		}
		VoiceInput.operationId += 1;
		VoiceInput.stopListeningToRelease();
		VoiceInput.pendingRelease = 'none';
		voiceInput.isLatched = false;
		voiceInput.error = null;
		const cancelling = VoiceInput.discardRecording();
		VoiceInput.cancelling = cancelling;
		voiceInput.state = 'idle';
		await cancelling;
		if (VoiceInput.cancelling === cancelling) {
			VoiceInput.cancelling = null;
		}
	}

	/**
	 * Writes a text at the end of the text of the composition bar, after one space when the bar already has a text. A bar that was
	 * closed during the change keeps nothing: closing the bar removes the text.
	 * @param text The text that Whisper gave. It can be empty.
	 * @returns Nothing.
	 */
	static appendToCompositionBar(text: string): void {
		const spoken = text.trim();
		const paneId = voiceInput.ownerPaneId;
		if (spoken === "" || paneId === null) {
			return;
		}
		const compositionBar = CompositionBar.forPane(paneId);
		if (compositionBar.isOpen === false) {
			return;
		}
		const current = compositionBar.text;
		const separator = current === "" || /\s$/.test(current) ? "" : " ";
		compositionBar.text = `${current}${separator}${spoken}`;
	}

	/**
	 * Opens the composition bar and the microphone. The recording ends at the release of a long press, or at the next press after
	 * a short press.
	 * @param paneId The identifier of the pane whose push-to-talk button started the recording.
	 * @returns Resolves after the microphone starts or reports an error.
	 */
	private static async startRecording(paneId: string): Promise<void> {
		if (VoiceInput.cancelling !== null) {
			await VoiceInput.cancelling;
			VoiceInput.cancelling = null;
		}
		if (settings.voiceInput === false || voiceInput.state !== "idle") {
			return;
		}
		voiceInput.ownerPaneId = paneId;
		if (VoiceInput.isModelReady() === false) {
			voiceInput.error = "model_missing";
			return;
		}
		const operationId = ++VoiceInput.operationId;
		voiceInput.error = null;
		voiceInput.state = "starting";
		voiceInput.isLatched = false;
		voiceInput.levels = [];
		VoiceInput.pendingRelease = "none";
		VoiceInput.pressedAt = Date.now();
		voiceInput.startedAt = VoiceInput.pressedAt;
		CompositionBar.forPane(paneId).isOpen = true;
		VoiceInput.listenToRelease();
		try {
			await VoiceInput.listenToLevels();
			if (operationId !== VoiceInput.operationId) {
				return;
			}
			VoiceInput.starting = invoke<void>('voice_start_recording');
			await VoiceInput.starting;
		} catch (error) {
			if (operationId !== VoiceInput.operationId) {
				return;
			}
			VoiceInput.stopListeningToRelease();
			voiceInput.error = String(error);
			voiceInput.state = "idle";
			return;
		}
		if (operationId !== VoiceInput.operationId || voiceInput.state !== 'starting') {
			return;
		}
		voiceInput.state = "recording";
		const pendingRelease = VoiceInput.takePendingRelease();
		if (pendingRelease === "stop") {
			await VoiceInput.stopAndWrite();
		} else if (pendingRelease === "keep") {
			VoiceInput.keepRecording();
		}
	}

	/**
	 * Waits for an opening microphone before discarding it. Starting another recording waits for this command.
	 * @returns Resolves after the discard command, including when the microphone failed to open.
	 */
	private static async discardRecording(): Promise<void> {
		try {
			await VoiceInput.starting;
		} catch {
			// A microphone that failed to open has no audio to keep.
		}
		VoiceInput.starting = null;
		try {
			await invoke('voice_cancel_recording');
		} catch {
			// There is nothing left to throw away.
		}
	}

	/** Starts, once, to keep the last levels of the voice in `voiceInput.levels` while the microphone records. */
	private static async listenToLevels(): Promise<void> {
		if (VoiceInput.isListeningToLevels === true) {
			return;
		}
		VoiceInput.isListeningToLevels = true;
		await listen<number>(LEVEL_EVENT, (event) => {
			if (voiceInput.state !== "recording" && voiceInput.state !== "starting") {
				return;
			}
			voiceInput.levels = [...voiceInput.levels, event.payload].slice(-LEVEL_COUNT);
		});

	}

	/**
	 * Waits until the state is "idle".
	 * @returns A promise that resolves at once when the state is already "idle".
	 */
	private static waitForIdle(): Promise<void> {
		if (voiceInput.state === "idle") {
			return Promise.resolve();
		}
		return new Promise((resolve) => {
			const stopWatching = watch(
				() => voiceInput.state,
				(state) => {
					if (state === "idle") {
						stopWatching();
						resolve();
					}
				},
				{ flush: "sync" },
			);
		});
	}

	/** The recording goes on after the release: the pointer and the loss of the keyboard no longer end it. */
	private static keepRecording(): void {
		VoiceInput.stopListeningToRelease();
		voiceInput.isLatched = true;
	}

	/**
	 * Reads and clears what the developer did with the button while the microphone was opening.
	 * @returns "stop" after a long press, "keep" after a short press, and "none" while the button is still down.
	 */
	private static takePendingRelease(): "none" | "keep" | "stop" {
		const pendingRelease = VoiceInput.pendingRelease;
		VoiceInput.pendingRelease = "none";
		return pendingRelease;
	}

	/** Hears the release of the pointer anywhere in the window, and the loss of the keyboard by the window. */
	private static listenToRelease(): void {
		window.addEventListener("pointerup", VoiceInput.onPointerRelease, true);
		window.addEventListener("pointercancel", VoiceInput.onPointerRelease, true);
		window.addEventListener("blur", VoiceInput.onBlur);
	}

	private static stopListeningToRelease(): void {
		window.removeEventListener("pointerup", VoiceInput.onPointerRelease, true);
		window.removeEventListener("pointercancel", VoiceInput.onPointerRelease, true);
		window.removeEventListener("blur", VoiceInput.onBlur);
	}

	private static onPointerRelease = (): void => {
		void VoiceInput.release();
	};

	private static onBlur = (): void => {
		void VoiceInput.release(true);
	};
}
