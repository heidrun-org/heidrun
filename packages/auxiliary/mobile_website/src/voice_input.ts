///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	VoiceInput — turns the voice of the developer into text, with the Web Speech API of the browser
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One result of the recognition: the text of one part of the speech. */
type SpeechResult = {
	/** True when the browser will not change this text anymore. */
	readonly isFinal: boolean;
	/** The best text that the browser found. */
	readonly 0: {
		/** The words that the browser heard. */
		readonly transcript: string;
	};
};

/** The event that the browser sends when it hears words. */
type SpeechResultEvent = {
	/** Every result since the start, in order. */
	readonly results: ArrayLike<SpeechResult>;
};

/** The event that the browser sends when the recognition fails. */
type SpeechErrorEvent = {
	/** The name of the error, for example `not-allowed`. */
	readonly error: string;
};

/** The part of the `SpeechRecognition` object of the browser that the page uses. */
type SpeechRecognitionLike = {
	/** The language of the speech, for example `en-US`. */
	lang: string;
	/** True to listen until the developer stops, false to stop after one sentence. */
	continuous: boolean;
	/** True to receive the text while the developer speaks, not only at the end. */
	interimResults: boolean;
	/** Called each time that the browser hears words. */
	onresult: ((event: SpeechResultEvent) => void) | null;
	/** Called when the recognition fails. */
	onerror: ((event: SpeechErrorEvent) => void) | null;
	/** Called when the recognition stops, after a success or an error. */
	onend: (() => void) | null;
	/** Starts to listen. */
	start(): void;
	/** Stops to listen, and keeps the text heard until now. */
	stop(): void;
};

/** The constructor of `SpeechRecognition`, with or without the prefix `webkit`. */
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** What the page does with the voice of the developer. */
export type VoiceInputListener = {
	/** Called with the whole text heard since the start, each time that it changes. */
	onText: (text: string) => void;
	/** Called with a text for the developer when the recognition fails. */
	onError: (message: string) => void;
	/** Called when the recognition stops. */
	onEnd: () => void;
};

/**
 * Listens to the microphone and gives the words that the developer says. The browser of the phone does the
 * recognition. The page sends nothing to another address, so the content security policy of the mobile server does
 * not change.
 */
export class VoiceInput {
	/** The recognition that listens now, or null. */
	private recognition: SpeechRecognitionLike | null = null;

	/**
	 * Tells if the browser has the Web Speech API. When it has none, the page shows no microphone button, and the
	 * microphone key of the keyboard of the phone is the fallback.
	 * @returns True when the browser can turn the voice into text.
	 */
	static isAvailable(): boolean {
		return VoiceInput._recognitionConstructor() !== null;
	}

	/**
	 * Joins the results of the recognition into one text. Chrome on Android gives each result as the whole text
	 * heard until then ("hello", "hello how", "hello how are"), so a result that starts with the text of the
	 * result before it replaces that result, and the words are not repeated.
	 * @param transcripts The text of each result, in order.
	 * @returns The words heard, once each.
	 */
	static joinResults(transcripts: string[]): string {
		const parts: string[] = [];
		for (const transcript of transcripts) {
			const part = transcript.trim();
			if (part === '') {
				continue;
			}
			const last = parts[parts.length - 1];
			if (last !== undefined && part.startsWith(last)) {
				parts[parts.length - 1] = part;
			} else {
				parts.push(part);
			}
		}
		return parts.join(' ');
	}

	/**
	 * Tells if the microphone listens now.
	 * @returns True between `start` and the end of the recognition.
	 */
	isListening(): boolean {
		return this.recognition !== null;
	}

	/**
	 * Starts to listen. Nothing happens when the browser has no Web Speech API, or when it listens already.
	 * @param listener What to do with the text, with an error, and at the end.
	 */
	start(listener: VoiceInputListener): void {
		const Recognition = VoiceInput._recognitionConstructor();
		if (Recognition === null || this.recognition !== null) {
			return;
		}
		const recognition = new Recognition();
		recognition.lang = navigator.language;
		// One sentence for each tap: Chrome on Android repeats the words in continuous mode.
		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.onresult = (event) => {
			const transcripts: string[] = [];
			for (let index = 0; index < event.results.length; index++) {
				transcripts.push(event.results[index][0].transcript);
			}
			listener.onText(VoiceInput.joinResults(transcripts));
		};
		recognition.onerror = (event) => {
			listener.onError(VoiceInput._errorMessage(event.error));
		};
		recognition.onend = () => {
			this.recognition = null;
			listener.onEnd();
		};
		this.recognition = recognition;
		try {
			recognition.start();
		} catch (error) {
			this.recognition = null;
			listener.onError(VoiceInput._errorMessage(error instanceof Error ? error.message : String(error)));
			listener.onEnd();
		}
	}

	/**
	 * Stops to listen. The browser sends the last words, then the end.
	 */
	stop(): void {
		this.recognition?.stop();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Private methods
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	private static _recognitionConstructor(): SpeechRecognitionConstructor | null {
		const scope = window as unknown as {
			SpeechRecognition?: SpeechRecognitionConstructor;
			webkitSpeechRecognition?: SpeechRecognitionConstructor;
		};
		return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
	}

	private static _errorMessage(error: string): string {
		if (error === 'not-allowed' || error === 'service-not-allowed') {
			return 'The microphone is not allowed: allow it in the settings of the browser';
		}
		if (error === 'no-speech') {
			return 'No voice heard';
		}
		return `The microphone does not work: ${error}`;
	}
}
