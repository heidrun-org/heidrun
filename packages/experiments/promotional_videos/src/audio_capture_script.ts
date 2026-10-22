///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AudioCaptureScript — the script that records the sound of a page of the game
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The file recorded by the script that runs in the page.
 */
export type CapturedAudio = {
	/** The time when the recording started, in milliseconds since 1970-01-01, as `Date.now()` gives it. */
	startEpochMilliseconds: number;
	/** The recorded sound, in the format WebM with the codec Opus, as base64 text. */
	base64: string;
};

/**
 * Playwright records no sound. The page of the game makes every sound with the Web Audio API, so this script, which the
 * browser runs before the page, copies everything that goes to the speakers of an audio context into a recorder of
 * the browser. After the run, the page gives the recorded sound back to Playwright.
 */
export class AudioCaptureScript {
	/** The expression that Playwright evaluates in the page at the end of the run. It gives a {@link CapturedAudio}. */
	static readonly FINISH_EXPRESSION = 'window.__audioCapture.finish()';

	/**
	 * Gives the text of the script that runs in the page before the page.
	 * @returns The script.
	 */
	static source(): string {
		return `
			(() => {
				const captures = new WeakMap();
				const state = { startEpochMilliseconds: null, recorder: null, chunks: [] };
				const originalConnect = AudioNode.prototype.connect;
				AudioNode.prototype.connect = function (target, ...rest) {
					if (target instanceof AudioDestinationNode && state.recorder === null) {
						const captureNode = target.context.createMediaStreamDestination();
						captures.set(target.context, captureNode);
						state.recorder = new MediaRecorder(captureNode.stream, { mimeType: 'audio/webm;codecs=opus' });
						state.recorder.ondataavailable = (event) => state.chunks.push(event.data);
						state.recorder.start(200);
						state.startEpochMilliseconds = Date.now();
					}
					if (target instanceof AudioDestinationNode && captures.has(target.context)) {
						originalConnect.call(this, captures.get(target.context));
					}
					return originalConnect.call(this, target, ...rest);
				};
				window.__audioCapture = {
					finish: async () => {
						if (state.recorder === null) {
							return null;
						}
						const stopped = new Promise((resolve) => { state.recorder.onstop = resolve; });
						state.recorder.stop();
						await stopped;
						const blob = new Blob(state.chunks, { type: 'audio/webm' });
						const base64 = await new Promise((resolve) => {
							const reader = new FileReader();
							reader.onload = () => resolve(String(reader.result).split(',')[1]);
							reader.readAsDataURL(blob);
						});
						return { startEpochMilliseconds: state.startEpochMilliseconds, base64 };
					},
				};
			})();
		`;
	}
}
