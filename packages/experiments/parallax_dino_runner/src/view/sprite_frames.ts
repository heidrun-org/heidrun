///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SpriteFrames — the pixel pictures of the dinosaur and of the cactus
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A filled rectangle of a pixel picture: the first column, the first row, the last column, the last row, and the
 * symbol.
 */
export type PixelRectangle = readonly [number, number, number, number, string];

/**
 * The pixel pictures. A picture is a list of rows of text. The symbol "#" is a dark pixel, the symbol "e" is the eye
 * of the dinosaur, and the symbol "." is no pixel. The dinosaur pictures are our own drawing in the pixel style of
 * Chrome Dino.
 */
export class SpriteFrames {
	/** The size of one pixel of a picture, in design units, on the near lane. */
	static readonly CELL = 2;

	/** The number of columns of a picture of the dinosaur. */
	static readonly DINOSAUR_COLUMNS = 24;

	/** The number of rows of a picture of the dinosaur. */
	static readonly DINOSAUR_ROWS = 26;

	/** The column of a picture of the dinosaur that stands at the place of the dinosaur. */
	static readonly DINOSAUR_CENTER_COLUMN = 12;

	/** The number of columns of the picture of the cactus. */
	static readonly CACTUS_COLUMNS = 14;

	/** The picture of the cactus. */
	static readonly CACTUS: readonly string[] = [
		'.....####.....',
		'.....####.....',
		'.....####.....',
		'.....####.....',
		'.....####.....',
		'.....####..##.',
		'.....####..##.',
		'.....####..##.',
		'.....####..##.',
		'.##..####..##.',
		'.##..####..##.',
		'.##..####..##.',
		'.##..####..##.',
		'.##..########.',
		'.##..########.',
		'.##..####.....',
		'.##..####.....',
		'.########.....',
		'.########.....',
		'.....####.....',
		'.....####.....',
		'.....####.....',
		'.....####.....',
		'.....####.....',
		'.....####.....',
		'.....####.....',
	];

	/** The parts of the dinosaur that every picture has: the head, the neck, the body, the tail, and the arm. */
	private static readonly _DINOSAUR_BODY: readonly PixelRectangle[] = [
		[14, 0, 22, 4, '#'],
		[14, 5, 20, 6, '#'],
		[12, 7, 17, 9, '#'],
		[8, 10, 19, 18, '#'],
		[5, 12, 7, 14, '#'],
		[3, 14, 4, 16, '#'],
		[1, 16, 2, 17, '#'],
		[20, 12, 22, 13, '#'],
	];

	/** The eye of the dinosaur: a square of two pixels. */
	private static readonly _EYE_OPEN: readonly PixelRectangle[] = [[16, 1, 17, 2, 'e']];

	/** The eye of a dinosaur that hit something: a cross. */
	private static readonly _EYE_HIT: readonly PixelRectangle[] = [
		[16, 1, 16, 1, 'e'],
		[18, 1, 18, 1, 'e'],
		[17, 2, 17, 2, 'e'],
		[16, 3, 16, 3, 'e'],
		[18, 3, 18, 3, 'e'],
	];

	/** The left leg on the ground. */
	private static readonly _LEFT_LEG_DOWN: readonly PixelRectangle[] = [
		[10, 19, 12, 24, '#'],
		[10, 25, 13, 25, '#'],
	];

	/** The right leg on the ground. */
	private static readonly _RIGHT_LEG_DOWN: readonly PixelRectangle[] = [
		[15, 19, 17, 24, '#'],
		[15, 25, 18, 25, '#'],
	];

	/** The left leg lifted. */
	private static readonly _LEFT_LEG_UP: readonly PixelRectangle[] = [
		[10, 19, 12, 21, '#'],
		[10, 22, 13, 22, '#'],
	];

	/** The right leg lifted. */
	private static readonly _RIGHT_LEG_UP: readonly PixelRectangle[] = [
		[15, 19, 17, 21, '#'],
		[15, 22, 18, 22, '#'],
	];

	/** The dinosaur that stands, and the dinosaur in the air. Both legs are down. */
	static readonly DINOSAUR_STAND: readonly string[] = SpriteFrames._build([
		...SpriteFrames._DINOSAUR_BODY,
		...SpriteFrames._EYE_OPEN,
		...SpriteFrames._LEFT_LEG_DOWN,
		...SpriteFrames._RIGHT_LEG_DOWN,
	]);

	/** The first picture of the run: the left leg is down, and the right leg is lifted. */
	static readonly DINOSAUR_RUN_A: readonly string[] = SpriteFrames._build([
		...SpriteFrames._DINOSAUR_BODY,
		...SpriteFrames._EYE_OPEN,
		...SpriteFrames._LEFT_LEG_DOWN,
		...SpriteFrames._RIGHT_LEG_UP,
	]);

	/** The second picture of the run: the left leg is lifted, and the right leg is down. */
	static readonly DINOSAUR_RUN_B: readonly string[] = SpriteFrames._build([
		...SpriteFrames._DINOSAUR_BODY,
		...SpriteFrames._EYE_OPEN,
		...SpriteFrames._LEFT_LEG_UP,
		...SpriteFrames._RIGHT_LEG_DOWN,
	]);

	/** The dinosaur that hit something. */
	static readonly DINOSAUR_HIT: readonly string[] = SpriteFrames._build([
		...SpriteFrames._DINOSAUR_BODY,
		...SpriteFrames._EYE_HIT,
		...SpriteFrames._LEFT_LEG_DOWN,
		...SpriteFrames._RIGHT_LEG_DOWN,
	]);

	/**
	 * Builds a picture of the dinosaur from rectangles. A later rectangle covers an earlier rectangle.
	 * @param rectangles The rectangles.
	 * @returns The rows of the picture, as text.
	 */
	private static _build(rectangles: readonly PixelRectangle[]): string[] {
		const rows: string[][] = [];
		for (let rowIndex = 0; rowIndex < SpriteFrames.DINOSAUR_ROWS; rowIndex += 1) {
			rows.push(new Array<string>(SpriteFrames.DINOSAUR_COLUMNS).fill('.'));
		}
		for (const [firstColumn, firstRow, lastColumn, lastRow, symbol] of rectangles) {
			for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
				for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
					rows[rowIndex][columnIndex] = symbol;
				}
			}
		}
		const texts = rows.map((row) => row.join(''));
		return texts;
	}
}
