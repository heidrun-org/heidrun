import type { GameEvent } from '../index.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SoundPlayer — makes the sound of each game event with the Web Audio API
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Makes the sound of each game event. The code builds every sound from oscillators and from noise, so the package has
 * no sound file. A browser lets a page make sound only after a key or a click, so the audio context starts at the
 * first call of {@link SoundPlayer.resume}, which the page calls from a key press.
 */
export class SoundPlayer {
	/** The volume of the whole game, from 0 to 1. */
	private static readonly _MASTER_VOLUME = 0.35;

	/** The audio context, or null before the first key press. */
	private _audioContext: AudioContext | null = null;

	/** The gain node that every sound goes through, or null before the first key press. */
	private _masterGain: GainNode | null = null;

	/** One second of white noise, which every noise sound reads, or null before the first key press. */
	private _noiseBuffer: AudioBuffer | null = null;

	/** True when the player turned the sound off. */
	private _isMuted = false;

	/**
	 * Starts the audio context at the first call, and wakes it up when the browser stopped it. Call it from a key
	 * press.
	 */
	resume(): void {
		if (this._audioContext === null) {
			this._audioContext = new AudioContext();
			this._masterGain = this._audioContext.createGain();
			this._masterGain.gain.value = SoundPlayer._MASTER_VOLUME;
			this._masterGain.connect(this._audioContext.destination);
			this._noiseBuffer = this._createNoiseBuffer(this._audioContext);
		}
		if (this._audioContext.state === 'suspended') {
			void this._audioContext.resume();
		}
	}

	/**
	 * Turns the sound off, or on again. A short note tells the player that the sound is on.
	 * @returns True when the sound is off now.
	 */
	toggleMuted(): boolean {
		this._isMuted = this._isMuted === false;
		if (this._isMuted === false) {
			this.play('start');
		}
		return this._isMuted;
	}

	/**
	 * Plays the sound of one event. Nothing happens when the sound is off, or before the first key press.
	 * @param event The event.
	 */
	play(event: GameEvent): void {
		if (this._isMuted === true || this._audioContext === null) {
			return;
		}
		if (event === 'start') {
			this._tone('square', 440, 440, 0.09, 0.1, 0);
			this._tone('square', 660, 660, 0.14, 0.1, 0.09);
		} else if (event === 'jump') {
			this._tone('square', 280, 620, 0.18, 0.12, 0);
		} else if (event === 'laneChange') {
			this._noise(0.12, 0.12, 2400, 600, 0);
		} else if (event === 'shoot') {
			this._tone('sawtooth', 1000, 160, 0.16, 0.12, 0);
			this._noise(0.05, 0.08, 6000, 2000, 0);
		} else if (event === 'shootEmpty') {
			this._tone('square', 130, 90, 0.07, 0.1, 0);
		} else if (event === 'rockShrunk') {
			this._noise(0.2, 0.3, 1400, 300, 0);
			this._tone('sine', 140, 60, 0.2, 0.3, 0);
		} else if (event === 'rockDestroyed') {
			this._noise(0.4, 0.4, 1800, 200, 0);
			this._tone('sine', 110, 40, 0.4, 0.4, 0);
		} else if (event === 'crate') {
			this._tone('sine', 660, 660, 0.08, 0.14, 0);
			this._tone('sine', 880, 880, 0.08, 0.14, 0.07);
			this._tone('sine', 1320, 1320, 0.14, 0.14, 0.14);
		} else if (event === 'hit') {
			this._tone('sawtooth', 420, 55, 0.6, 0.18, 0);
			this._noise(0.35, 0.3, 1600, 150, 0);
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Makes one second of white noise.
	 * @param audioContext The audio context.
	 * @returns The buffer of noise.
	 */
	private _createNoiseBuffer(audioContext: AudioContext): AudioBuffer {
		const buffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
		const samples = buffer.getChannelData(0);
		for (let index = 0; index < samples.length; index += 1) {
			samples[index] = Math.random() * 2 - 1;
		}
		return buffer;
	}

	/**
	 * Plays one note: an oscillator whose pitch slides and whose volume fades out.
	 * @param waveform The shape of the wave.
	 * @param startFrequency The pitch at the start, in hertz.
	 * @param endFrequency The pitch at the end, in hertz.
	 * @param seconds The duration of the note, in seconds.
	 * @param volume The volume at the start, from 0 to 1.
	 * @param delaySeconds The time to wait before the note starts, in seconds.
	 */
	private _tone(
		waveform: OscillatorType,
		startFrequency: number,
		endFrequency: number,
		seconds: number,
		volume: number,
		delaySeconds: number,
	): void {
		if (this._audioContext === null || this._masterGain === null) {
			return;
		}
		const startTime = this._audioContext.currentTime + delaySeconds;
		const oscillator = this._audioContext.createOscillator();
		const gain = this._audioContext.createGain();
		oscillator.type = waveform;
		oscillator.frequency.setValueAtTime(startFrequency, startTime);
		oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + seconds);
		gain.gain.setValueAtTime(volume, startTime);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + seconds);
		oscillator.connect(gain);
		gain.connect(this._masterGain);
		oscillator.start(startTime);
		oscillator.stop(startTime + seconds + 0.02);
	}

	/**
	 * Plays one burst of noise: white noise through a low-pass filter that closes, with a volume that fades out.
	 * @param seconds The duration of the burst, in seconds.
	 * @param volume The volume at the start, from 0 to 1.
	 * @param startCutoff The cutoff of the filter at the start, in hertz.
	 * @param endCutoff The cutoff of the filter at the end, in hertz.
	 * @param delaySeconds The time to wait before the burst starts, in seconds.
	 */
	private _noise(
		seconds: number,
		volume: number,
		startCutoff: number,
		endCutoff: number,
		delaySeconds: number,
	): void {
		if (this._audioContext === null || this._masterGain === null || this._noiseBuffer === null) {
			return;
		}
		const startTime = this._audioContext.currentTime + delaySeconds;
		const source = this._audioContext.createBufferSource();
		const filter = this._audioContext.createBiquadFilter();
		const gain = this._audioContext.createGain();
		source.buffer = this._noiseBuffer;
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(startCutoff, startTime);
		filter.frequency.exponentialRampToValueAtTime(endCutoff, startTime + seconds);
		gain.gain.setValueAtTime(volume, startTime);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + seconds);
		source.connect(filter);
		filter.connect(gain);
		gain.connect(this._masterGain);
		source.start(startTime);
		source.stop(startTime + seconds + 0.02);
	}
}
