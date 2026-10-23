import { AnsiPalette } from './ansi_palette';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AnsiParser — reads the escape codes of a terminal screen into lines of styled text
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** How a piece of text looks. */
export type AnsiStyle = {
	/** The color of the text as `#rrggbb`, or null for the default color. */
	foreground: string | null;
	/** The color of the background as `#rrggbb`, or null for the default color. */
	background: string | null;
	/** True for bold text. */
	isBold: boolean;
	/** True for dim text. */
	isDim: boolean;
	/** True for italic text. */
	isItalic: boolean;
	/** True for underlined text. */
	isUnderlined: boolean;
	/** True for crossed out text. */
	isStruck: boolean;
	/** True when the text color and the background color are swapped. */
	isInverse: boolean;
};

/** A piece of text with one style. */
export type AnsiSegment = {
	/** The text, with no escape code. */
	text: string;
	/** How the text looks. */
	style: AnsiStyle;
};

/** One line of the screen. */
export type AnsiLine = AnsiSegment[];

/**
 * Reads the text that `herdr pane read` gives with the format `ansi`. Only the codes that change how text looks are
 * kept. Every other code, such as a move of the cursor or a title of the window, is removed.
 */
export class AnsiParser {
	/**
	 * Matches what is not text: a code that changes the look (`ESC [ … m`) or another code of the screen, a
	 * command of the operating system (`ESC ] … BEL`), a choice of character set, a lone escape character, a
	 * carriage return, and the other control characters. The first group holds the numbers of a code, and the
	 * second group holds its last letter.
	 */
	private static readonly codePattern = new RegExp(
		[
			String.raw`\x1b\[([0-?]*)[ -/]*([@-~])`,
			String.raw`\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?`,
			String.raw`\x1b[()#][ -~]`,
			String.raw`\x1b[=>78]?`,
			String.raw`[\r\x00-\x08\x0b-\x1a\x1c-\x1f\x7f]`,
		].join('|'),
		'g',
	);

	/**
	 * Cuts a screen into lines of styled text.
	 * @param text The screen, with escape codes or without.
	 * @returns The lines. A text with no code gives lines with one plain segment each. A new object is made for
	 * every segment, so the caller may change the segments.
	 */
	static parse(text: string): AnsiLine[] {
		const lines: AnsiLine[] = [[]];
		let style = AnsiParser.plainStyle();
		let position = 0;
		for (const match of text.matchAll(AnsiParser.codePattern)) {
			AnsiParser.addText(lines, text.slice(position, match.index), style);
			position = match.index + match[0].length;
			if (match[2] === 'm' && /^[0-9;:]*$/.test(match[1])) {
				style = AnsiParser.applyCodes(style, match[1]);
			}
		}
		AnsiParser.addText(lines, text.slice(position), style);
		return lines;
	}

	/**
	 * Tells if a style is the default look.
	 * @param style The style.
	 * @returns True when the style changes nothing.
	 */
	static isPlain(style: AnsiStyle): boolean {
		return AnsiParser.sameStyle(style, AnsiParser.plainStyle());
	}

	private static plainStyle(): AnsiStyle {
		return {
			foreground: null,
			background: null,
			isBold: false,
			isDim: false,
			isItalic: false,
			isUnderlined: false,
			isStruck: false,
			isInverse: false,
		};
	}

	private static sameStyle(a: AnsiStyle, b: AnsiStyle): boolean {
		return (
			a.foreground === b.foreground &&
			a.background === b.background &&
			a.isBold === b.isBold &&
			a.isDim === b.isDim &&
			a.isItalic === b.isItalic &&
			a.isUnderlined === b.isUnderlined &&
			a.isStruck === b.isStruck &&
			a.isInverse === b.isInverse
		);
	}

	private static addText(lines: AnsiLine[], text: string, style: AnsiStyle): void {
		const pieces = text.split('\n');
		for (const [index, piece] of pieces.entries()) {
			if (index > 0) {
				lines.push([]);
			}
			if (piece === '') {
				continue;
			}
			const line = lines[lines.length - 1];
			const last = line[line.length - 1];
			if (last !== undefined && AnsiParser.sameStyle(last.style, style)) {
				last.text += piece;
			} else {
				line.push({
					text: piece,
					style,
				});
			}
		}
	}

	private static applyCodes(previous: AnsiStyle, numbers: string): AnsiStyle {
		const codeTexts = numbers === '' ? ['0'] : numbers.split(/[;:]/);
		const codes = codeTexts.map((codeText) => Number(codeText === '' ? '0' : codeText));
		const style = {
			...previous,
		};
		for (let index = 0; index < codes.length; index++) {
			const code = codes[index];
			if (code === 0) {
				Object.assign(style, AnsiParser.plainStyle());
			} else if (code === 1) {
				style.isBold = true;
			} else if (code === 2) {
				style.isDim = true;
			} else if (code === 3) {
				style.isItalic = true;
			} else if (code === 4 || code === 21) {
				style.isUnderlined = true;
			} else if (code === 7) {
				style.isInverse = true;
			} else if (code === 9) {
				style.isStruck = true;
			} else if (code === 22) {
				style.isBold = false;
				style.isDim = false;
			} else if (code === 23) {
				style.isItalic = false;
			} else if (code === 24) {
				style.isUnderlined = false;
			} else if (code === 27) {
				style.isInverse = false;
			} else if (code === 29) {
				style.isStruck = false;
			} else if (code >= 30 && code <= 37) {
				style.foreground = AnsiPalette.basic(code - 30);
			} else if (code >= 90 && code <= 97) {
				style.foreground = AnsiPalette.basic(code - 90 + 8);
			} else if (code >= 40 && code <= 47) {
				style.background = AnsiPalette.basic(code - 40);
			} else if (code >= 100 && code <= 107) {
				style.background = AnsiPalette.basic(code - 100 + 8);
			} else if (code === 39) {
				style.foreground = null;
			} else if (code === 49) {
				style.background = null;
			} else if (code === 38 || code === 48) {
				const extended = AnsiParser.readExtendedColor(codes, index + 1);
				if (code === 38) {
					style.foreground = extended.color;
				} else {
					style.background = extended.color;
				}
				index += extended.used;
			}
		}
		return style;
	}

	/**
	 * Reads what follows the code 38 or 48: `5;n` for one of 256 colors, or `2;r;g;b` for any color.
	 * @param codes All the numbers of the code.
	 * @param start The position of the number after 38 or 48.
	 * @returns The color, or null when the numbers are wrong, and how many numbers were read.
	 */
	private static readExtendedColor(codes: number[], start: number): { color: string | null; used: number } {
		if (codes[start] === 5) {
			return {
				color: AnsiPalette.indexed(codes[start + 1]),
				used: 2,
			};
		}
		if (codes[start] === 2) {
			return {
				color: AnsiPalette.rgb(codes[start + 1], codes[start + 2], codes[start + 3]),
				used: 4,
			};
		}
		return {
			color: null,
			used: 0,
		};
	}
}
