///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SeededRandom — a random number generator that repeats the same numbers for the same seed
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A random number generator with a fixed seed. Two generators with the same seed give the same numbers, so a test
 * can repeat a world. It uses the algorithm "mulberry32".
 */
export class SeededRandom {
	/** The inner state of the generator, as an unsigned 32-bit whole number. */
	private _state: number;

	/**
	 * @param seed The seed. Any whole number is good.
	 */
	constructor(seed: number) {
		this._state = seed >>> 0;
	}

	/**
	 * Gives the next number.
	 * @returns A number from 0 up to, but not including, 1.
	 */
	next(): number {
		this._state = (this._state + 0x6d2b79f5) >>> 0;
		let value = this._state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		const number = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
		return number;
	}

	/**
	 * Gives the next number between two limits.
	 * @param minimum The smallest number.
	 * @param maximum The number that the result stays below.
	 * @returns A number from the minimum up to, but not including, the maximum.
	 */
	range(minimum: number, maximum: number): number {
		const number = minimum + this.next() * (maximum - minimum);
		return number;
	}

	/**
	 * Gives the next whole number between two limits.
	 * @param minimum The smallest whole number.
	 * @param maximum The largest whole number.
	 * @returns A whole number from the minimum to the maximum, both included.
	 */
	integer(minimum: number, maximum: number): number {
		const number = minimum + Math.floor(this.next() * (maximum - minimum + 1));
		return number;
	}
}
