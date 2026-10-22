import { describe, expect, it } from 'vitest';
import { AnsiParser } from '../src/ansi_parser';
import type { AnsiStyle } from '../src/ansi_parser';
import { AnsiPalette } from '../src/ansi_palette';

const esc = '\x1b';

const plain: AnsiStyle = {
	foreground: null,
	background: null,
	isBold: false,
	isDim: false,
	isItalic: false,
	isUnderlined: false,
	isStruck: false,
	isInverse: false,
};

describe('AnsiParser', () => {
	it('gives one plain segment for a text with no code', () => {
		expect(AnsiParser.parse('hello')).toEqual([
			[
				{
					text: 'hello',
					style: plain,
				},
			],
		]);
	});

	it('cuts the text into lines, and gives an empty list for an empty line', () => {
		const lines = AnsiParser.parse('one\n\ntwo');
		expect(lines.map((line) => line.map((segment) => segment.text))).toEqual([['one'], [], ['two']]);
	});

	it('gives one empty line for an empty text', () => {
		expect(AnsiParser.parse('')).toEqual([[]]);
	});

	it('reads the 8 normal colors and the 8 bright colors of the text', () => {
		const segments = AnsiParser.parse(`${esc}[31ma${esc}[92mb`)[0];
		expect(segments.map((segment) => segment.style.foreground)).toEqual([
			AnsiPalette.basic(1),
			AnsiPalette.basic(10),
		]);
	});

	it('reads the 8 normal colors and the 8 bright colors of the background', () => {
		const segments = AnsiParser.parse(`${esc}[41ma${esc}[102mb`)[0];
		expect(segments.map((segment) => segment.style.background)).toEqual([
			AnsiPalette.basic(1),
			AnsiPalette.basic(10),
		]);
	});

	it('reads one color of the 256 colors', () => {
		const segments = AnsiParser.parse(`${esc}[38;5;196mred${esc}[48;5;21mblue`)[0];
		expect(segments.map((segment) => segment.style)).toEqual([
			{
				...plain,
				foreground: '#ff0000',
			},
			{
				...plain,
				foreground: '#ff0000',
				background: '#0000ff',
			},
		]);
	});

	it('reads a color from its three channels, with a semicolon or a colon', () => {
		expect(AnsiParser.parse(`${esc}[38;2;10;20;30ma`)[0][0].style.foreground).toBe('#0a141e');
		expect(AnsiParser.parse(`${esc}[48:2:255:128:0ma`)[0][0].style.background).toBe('#ff8000');
	});

	it('reads several codes that are in one escape sequence, and keeps the codes that come after a color', () => {
		const style = AnsiParser.parse(`${esc}[1;38;5;33;4mx`)[0][0].style;
		expect(style).toEqual({
			...plain,
			foreground: '#0087ff',
			isBold: true,
			isUnderlined: true,
		});
	});

	it('reads every effect, and the codes that stop each one', () => {
		const text = `${esc}[1;2;3;4;7;9mx${esc}[22;23;24;27;29my`;
		const segments = AnsiParser.parse(text)[0];
		expect(segments[0].style).toEqual({
			...plain,
			isBold: true,
			isDim: true,
			isItalic: true,
			isUnderlined: true,
			isInverse: true,
			isStruck: true,
		});
		expect(segments[1].style).toEqual(plain);
	});

	it('resets everything with the code 0, and with an empty code', () => {
		expect(AnsiParser.parse(`${esc}[31;1ma${esc}[0mb`)[0][1].style).toEqual(plain);
		expect(AnsiParser.parse(`${esc}[31;1ma${esc}[mb`)[0][1].style).toEqual(plain);
	});

	it('resets only the text color with the code 39, and only the background with the code 49', () => {
		const segments = AnsiParser.parse(`${esc}[31;42ma${esc}[39mb${esc}[49mc`)[0];
		expect(segments[1].style.foreground).toBeNull();
		expect(segments[1].style.background).toBe(AnsiPalette.basic(2));
		expect(segments[2].style.background).toBeNull();
	});

	it('keeps the style across a new line', () => {
		const lines = AnsiParser.parse(`${esc}[31mone\ntwo`);
		expect(lines[1][0].style.foreground).toBe(AnsiPalette.basic(1));
	});

	it('joins the pieces that have the same style', () => {
		expect(AnsiParser.parse(`${esc}[31ma${esc}[31mb`)[0].map((segment) => segment.text)).toEqual(['ab']);
	});

	it('removes the codes that are not about the look: the cursor, the title, the character sets', () => {
		const text = [
			`a${esc}[2Kb${esc}[10;5Hc`,
			`${esc}]0;title\x07d${esc}]8;;http://x${esc}\\e`,
			`${esc}(Bf${esc}[?25hg`,
		].join('');
		expect(AnsiParser.parse(text)[0].map((segment) => segment.text)).toEqual(['abcdefg']);
	});

	it('removes a carriage return and the other control characters, and keeps a tab', () => {
		expect(AnsiParser.parse('a\r\x00\x07b\tc')[0][0].text).toBe('ab\tc');
	});

	it('ignores a color that is out of range, and a color that is cut', () => {
		expect(AnsiParser.parse(`${esc}[38;5;999mx`)[0][0].style.foreground).toBeNull();
		expect(AnsiParser.parse(`${esc}[38;2;300;0;0mx`)[0][0].style.foreground).toBeNull();
		expect(AnsiParser.parse(`${esc}[38;2;1mx`)[0][0].style.foreground).toBeNull();
		expect(AnsiParser.parse(`${esc}[38mx`)[0][0].style.foreground).toBeNull();
	});

	it('ignores a code with a private marker, even when it ends with the letter m', () => {
		expect(AnsiParser.parse(`${esc}[>4;2mx`)[0][0].style).toEqual(plain);
	});

	it('ignores a code that it does not know', () => {
		expect(AnsiParser.parse(`${esc}[5;53;99mx`)[0][0].style).toEqual(plain);
	});

	it('tells if a style is the default look', () => {
		expect(AnsiParser.isPlain(plain)).toBe(true);
		expect(
			AnsiParser.isPlain({
				...plain,
				isDim: true,
			}),
		).toBe(false);
	});
});

describe('AnsiPalette', () => {
	it('gives the colors of the corners of the cube, and of the gray ramp', () => {
		expect(AnsiPalette.indexed(16)).toBe('#000000');
		expect(AnsiPalette.indexed(231)).toBe('#ffffff');
		expect(AnsiPalette.indexed(232)).toBe('#080808');
		expect(AnsiPalette.indexed(255)).toBe('#eeeeee');
	});

	it('gives the 16 first colors of the 256 colors', () => {
		expect(AnsiPalette.indexed(1)).toBe(AnsiPalette.basic(1));
	});

	it('gives nothing for a number or a channel outside the range', () => {
		expect(AnsiPalette.indexed(-1)).toBeNull();
		expect(AnsiPalette.indexed(256)).toBeNull();
		expect(AnsiPalette.indexed(1.5)).toBeNull();
		expect(AnsiPalette.indexed(Number.NaN)).toBeNull();
		expect(AnsiPalette.basic(16)).toBeNull();
		expect(AnsiPalette.rgb(0, 0, -1)).toBeNull();
		expect(AnsiPalette.rgb(0, 256, 0)).toBeNull();
		expect(AnsiPalette.rgb(Number.NaN, 0, 0)).toBeNull();
	});
});
