///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FrontendSource — removes the comments of a web page file, so that a check does not find a call in a comment
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Prepares the text of a TypeScript file or of a Vue file for the checks. The string contents stay, because the name of a
 * Tauri command is a string.
 */
export class FrontendSource {
	/**
	 * Replaces the comments of a file by spaces and keeps the new lines.
	 *
	 * @param text - The text of the file.
	 * @param isVueFile - True for a Vue file, where a comment of HTML is possible, and where only the script blocks hold code.
	 * @returns The text with no comment, and the same positions as the original text.
	 */
	static blankComments(text: string, isVueFile: boolean): string {
		if (isVueFile === false) {
			return FrontendSource._blankScriptComments(text);
		}
		let output = text.replace(/<!--[\s\S]*?-->/g, (comment) => {
			return FrontendSource._spaces(comment);
		});
		output = output.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g, (block, opening, content, closing) => {
			return `${opening}${FrontendSource._blankScriptComments(content)}${closing}`;
		});
		return output;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Replaces the comments of a script by spaces. A string or a template literal is skipped, so `https://` is not a comment.
	 *
	 * @param text - The text of the script.
	 * @returns The text with no comment.
	 */
	private static _blankScriptComments(text: string): string {
		const output = text.split('');
		let index = 0;
		while (index < text.length) {
			const character = text[index];
			if (character === '/' && text[index + 1] === '/') {
				const end = FrontendSource._lineEnd(text, index);
				FrontendSource._blank(output, index, end);
				index = end;
				continue;
			}
			if (character === '/' && text[index + 1] === '*') {
				const closing = text.indexOf('*/', index + 2);
				const end = closing === -1 ? text.length : closing + 2;
				FrontendSource._blank(output, index, end);
				index = end;
				continue;
			}
			if (character === '"' || character === "'" || character === '`') {
				index = FrontendSource._stringEnd(text, index, character);
				continue;
			}
			index += 1;
		}
		return output.join('');
	}

	/**
	 * Finds the end of a string. A string with single or double quotes stops at the end of the line, so a regular expression
	 * that holds a quote does not hide the rest of the file.
	 *
	 * @param text - The text.
	 * @param start - The position of the opening quote.
	 * @param quote - The quote character.
	 * @returns The position after the closing quote.
	 */
	private static _stringEnd(text: string, start: number, quote: string): number {
		let index = start + 1;
		while (index < text.length) {
			const character = text[index];
			if (character === '\\') {
				index += 2;
				continue;
			}
			if (character === quote) {
				return index + 1;
			}
			if (character === '\n' && quote !== '`') {
				return index;
			}
			index += 1;
		}
		return text.length;
	}

	/**
	 * Finds the end of a line.
	 *
	 * @param text - The text.
	 * @param start - A position in the line.
	 * @returns The position of the new line, or the length of the text.
	 */
	private static _lineEnd(text: string, start: number): number {
		const end = text.indexOf('\n', start);
		if (end === -1) {
			return text.length;
		}
		return end;
	}

	/**
	 * Replaces the characters of a range by spaces, except the new lines.
	 *
	 * @param output - The characters of the text, changed in place.
	 * @param start - The first position to replace.
	 * @param end - The position after the last one to replace.
	 */
	private static _blank(output: string[], start: number, end: number): void {
		for (let index = start; index < end && index < output.length; index += 1) {
			if (output[index] !== '\n') {
				output[index] = ' ';
			}
		}
	}

	/**
	 * Gives a text of spaces with the same length and the same new lines as a text.
	 *
	 * @param text - The text to replace.
	 * @returns The text of spaces.
	 */
	private static _spaces(text: string): string {
		return text.replace(/[^\n]/g, ' ');
	}
}
