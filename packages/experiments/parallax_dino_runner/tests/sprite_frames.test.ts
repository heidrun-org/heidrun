import { describe, expect, it } from 'vitest';
import { SpriteFrames } from '../src/view/sprite_frames.ts';

describe('SpriteFrames', () => {
	const dinosaurFrames: readonly (readonly string[])[] = [
		SpriteFrames.DINOSAUR_STAND,
		SpriteFrames.DINOSAUR_RUN_A,
		SpriteFrames.DINOSAUR_RUN_B,
		SpriteFrames.DINOSAUR_HIT,
	];

	it('gives every picture of the dinosaur the same number of rows and columns', () => {
		for (const frame of dinosaurFrames) {
			expect(frame).toHaveLength(SpriteFrames.DINOSAUR_ROWS);
			for (const row of frame) {
				expect(row).toHaveLength(SpriteFrames.DINOSAUR_COLUMNS);
			}
		}
	});

	it('gives the picture of the cactus the same number of columns in every row', () => {
		for (const row of SpriteFrames.CACTUS) {
			expect(row).toHaveLength(SpriteFrames.CACTUS_COLUMNS);
		}
	});

	it('uses only the symbols that the palette knows', () => {
		for (const frame of [...dinosaurFrames, SpriteFrames.CACTUS]) {
			for (const row of frame) {
				expect(row).toMatch(/^[.#e]+$/);
			}
		}
	});

	it('draws the feet of every picture of the dinosaur on the last rows', () => {
		expect(SpriteFrames.DINOSAUR_STAND[SpriteFrames.DINOSAUR_ROWS - 1]).toContain('#');
		expect(SpriteFrames.DINOSAUR_RUN_A[SpriteFrames.DINOSAUR_ROWS - 1]).toContain('#');
		expect(SpriteFrames.DINOSAUR_RUN_B[SpriteFrames.DINOSAUR_ROWS - 1]).toContain('#');
	});

	it('changes the legs between the two pictures of the run', () => {
		expect(SpriteFrames.DINOSAUR_RUN_A).not.toEqual(SpriteFrames.DINOSAUR_RUN_B);
	});
});
