import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceInput } from '../src/voice_input';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';

/** A fake `SpeechRecognition` of the browser. The test says the words. */
class FakeRecognition {
	/** The recognition that started last. */
	static last: FakeRecognition | null = null;

	lang = '';
	continuous = false;
	interimResults = false;
	onresult: ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null;
	onerror: ((event: { error: string }) => void) | null = null;
	onend: (() => void) | null = null;
	isStarted = false;

	start(): void {
		this.isStarted = true;
		FakeRecognition.last = this;
	}

	stop(): void {
		this.isStarted = false;
		this.onend?.();
	}

	say(...transcripts: string[]): void {
		this.onresult?.({
			results: transcripts.map((transcript) => ({
				isFinal: true,
				0: {
					transcript,
				},
			})),
		});
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
	FakeRecognition.last = null;
});

describe('Microphone button', () => {
	it('is not shown when the browser has no Web Speech API', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.openPane('p-working');
		expect(document.querySelector('[data-action="voice"]')).toBeNull();
	});

	it('puts the words in the field for a prompt, after the text that is there, and sends nothing', async () => {
		vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
		const computer = Fixtures.computer();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-working');
		harness.field().value = 'Please';
		await harness.tap('[data-action="voice"]');
		expect(FakeRecognition.last?.isStarted).toBe(true);
		expect(document.querySelector('[data-action="voice"]')?.getAttribute('aria-pressed')).toBe('true');
		FakeRecognition.last?.say('fix the test', ' and commit ');
		expect(harness.field().value).toBe('Please fix the test and commit');
		await harness.tap('[data-action="voice"]');
		expect(FakeRecognition.last?.isStarted).toBe(false);
		expect(document.querySelector('[data-action="voice"]')?.getAttribute('aria-pressed')).toBe('false');
		expect(computer.callsOf('prompt')).toEqual([]);
	});

	it('does not repeat the words when each result holds the whole text heard until then, like Chrome on Android', async () => {
		vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.openPane('p-working');
		await harness.tap('[data-action="voice"]');
		FakeRecognition.last?.say('hello', 'hello how', 'hello how are', 'hello how are you today');
		expect(harness.field().value).toBe('hello how are you today');
		expect(FakeRecognition.last?.continuous).toBe(false);
	});

	it('keeps two sentences that do not repeat each other', () => {
		expect(VoiceInput.joinResults(['fix the test', ' and commit '])).toBe('fix the test and commit');
		expect(VoiceInput.joinResults(['are', 'are you', 'are you good'])).toBe('are you good');
	});

	it('keeps the words when a refresh comes while the microphone listens', async () => {
		vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
		const computer = Fixtures.computer();
		const harness = await AppHarness.start(computer);
		await harness.openPane('p-working');
		await harness.tap('[data-action="voice"]');
		FakeRecognition.last?.say('hello');
		computer.outputText = 'a new line\n';
		await harness.settle(3000);
		expect(harness.field().value).toBe('hello');
	});

	it('says that the microphone is not allowed', async () => {
		vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.openPane('p-working');
		await harness.tap('[data-action="voice"]');
		FakeRecognition.last?.onerror?.({ error: 'not-allowed' });
		expect(harness.toast()).toBe('The microphone is not allowed: allow it in the settings of the browser');
	});
});
