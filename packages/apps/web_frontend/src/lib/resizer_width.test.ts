import { describe, expect, it } from 'vitest';
import { ResizerWidth } from './resizer_width';

describe('ResizerWidth.clamp', () => {
	const limits = {
		min: 200,
		max: 520,
		reserve: 0,
	};

	it('keeps a width that is between the limits', () => {
		expect(ResizerWidth.clamp(300, limits, 2000)).toBe(300);
	});

	it('raises a width that is under the smallest width', () => {
		expect(ResizerWidth.clamp(50, limits, 2000)).toBe(200);
	});

	it('lowers a width that is over the largest width', () => {
		expect(ResizerWidth.clamp(900, limits, 2000)).toBe(520);
	});

	it('leaves 420 pixels to the middle of the window, after the width of the other columns', () => {
		const withReserve = {
			...limits,
			reserve: 300,
		};
		expect(ResizerWidth.clamp(500, withReserve, 1000)).toBe(280);
	});

	it('rounds to a whole number of pixels', () => {
		expect(ResizerWidth.clamp(300.6, limits, 2000)).toBe(301);
	});
});
