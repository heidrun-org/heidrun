/**
 * Builds the answer to the terminal colour questions (the escape sequences OSC 10 and OSC 11) that a program such as
 * Codex sends to learn the foreground and background colours of the terminal.
 */
export class TerminalColorReply {
	/**
	 * Converts a hexadecimal colour such as "#ffffff" to the format "rgb:ffff/ffff/ffff" used in the answer.
	 *
	 * @param hexColor - A colour written as "#rrggbb".
	 * @returns The colour in the format "rgb:rrrr/gggg/bbbb", or null when the input is not a "#rrggbb" colour.
	 */
	static toRgbString(hexColor: string): string | null {
		const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hexColor);
		if (match === null) {
			return null;
		}
		const [red, green, blue] = [match[1], match[2], match[3]].map((part) => part.toLowerCase() + part.toLowerCase());
		return `rgb:${red}/${green}/${blue}`;
	}

	/**
	 * Answers one colour question, or ignores it when the question is not a query.
	 *
	 * @param oscNumber - 10 for the foreground colour, 11 for the background colour.
	 * @param data - The text after the OSC number. A question is the single character "?".
	 * @param hexColor - The current colour of the terminal, written as "#rrggbb".
	 * @returns The text to send back to the program, or null when nothing must be sent.
	 */
	static answer(oscNumber: 10 | 11, data: string, hexColor: string | undefined): string | null {
		if (data !== '?' || hexColor === undefined) {
			return null;
		}
		const rgbString = TerminalColorReply.toRgbString(hexColor);
		if (rgbString === null) {
			return null;
		}
		return `\x1b]${oscNumber};${rgbString}\x1b\\`;
	}
}
