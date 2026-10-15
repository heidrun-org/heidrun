///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AnsiPalette — the colors of a terminal, as hexadecimal color values
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Gives the color of a terminal color number, or of a red, green, and blue triple.
 */
export class AnsiPalette {
	/** The color of the text of the output when no color is set. It is the color in `style.css`. */
	static readonly defaultForeground = '#b6b9bd';

	/** The color of the background of the output when no color is set. It is the color in `style.css`. */
	static readonly defaultBackground = '#08090a';

	/** The 16 colors of a terminal, tuned for a dark background. The first one is a dark gray: it stays visible. */
	private static readonly sixteen = [
		'#3a3f45',
		'#cd3131',
		'#0dbc79',
		'#e5e510',
		'#2472c8',
		'#bc3fbc',
		'#11a8cd',
		'#e5e5e5',
		'#666666',
		'#f14c4c',
		'#23d18b',
		'#f5f543',
		'#3b8eea',
		'#d670d6',
		'#29b8db',
		'#ffffff',
	];

	/** The six levels of each channel in the color cube of the 256 colors. */
	private static readonly cubeLevels = [0, 95, 135, 175, 215, 255];

	/**
	 * Gives one of the 16 first colors.
	 * @param index The number from 0 to 15. 0 to 7 are the normal colors, and 8 to 15 are the bright colors.
	 * @returns The color, or null when the number is outside the range.
	 */
	static basic(index: number): string | null {
		return AnsiPalette.sixteen[index] ?? null;
	}

	/**
	 * Gives one color of the 256 colors of a terminal.
	 * @param index The number from 0 to 255: 0 to 15 the 16 colors, 16 to 231 a cube of colors, 232 to 255 grays.
	 * @returns The color, or null when the number is outside the range.
	 */
	static indexed(index: number): string | null {
		if (Number.isInteger(index) === false || index < 0 || index > 255) {
			return null;
		}
		if (index < 16) {
			return AnsiPalette.sixteen[index];
		}
		if (index >= 232) {
			const level = 8 + 10 * (index - 232);
			return AnsiPalette.rgb(level, level, level);
		}
		const cubeIndex = index - 16;
		const red = AnsiPalette.cubeLevels[Math.floor(cubeIndex / 36)];
		const green = AnsiPalette.cubeLevels[Math.floor(cubeIndex / 6) % 6];
		const blue = AnsiPalette.cubeLevels[cubeIndex % 6];
		return AnsiPalette.rgb(red, green, blue);
	}

	/**
	 * Writes a color from its three channels.
	 * @param red The red channel, from 0 to 255.
	 * @param green The green channel, from 0 to 255.
	 * @param blue The blue channel, from 0 to 255.
	 * @returns The color as `#rrggbb`, or null when a channel is not a whole number from 0 to 255.
	 */
	static rgb(red: number, green: number, blue: number): string | null {
		const channels = [red, green, blue];
		if (channels.some((channel) => Number.isInteger(channel) === false || channel < 0 || channel > 255)) {
			return null;
		}
		return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
	}
}
