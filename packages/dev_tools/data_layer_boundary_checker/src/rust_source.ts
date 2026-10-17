import type { PreparedRustSource, StringLiteral } from './boundary_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	RustSource — turns the text of a Rust file into code that a check can search without false matches
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Prepares the text of a Rust file for the checks. A comment, the content of a string, and a block of test code never hold a
 * call that the application makes, so the preparation replaces each one by spaces and keeps the new lines.
 */
export class RustSource {
	/**
	 * Replaces the comments, the string contents, and the test code of a Rust file by spaces.
	 *
	 * @param text - The text of the file.
	 * @returns The code without comments, strings, and test code, and the string literals that are not in test code.
	 */
	static prepare(text: string): PreparedRustSource {
		const output = text.split('');
		const stringLiterals: StringLiteral[] = [];
		let index = 0;
		while (index < text.length) {
			const character = text[index];
			const following = text[index + 1];
			if (character === '/' && following === '/') {
				const end = RustSource._lineEnd(text, index);
				RustSource._blank(output, index, end);
				index = end;
				continue;
			}
			if (character === '/' && following === '*') {
				const end = RustSource._blockCommentEnd(text, index);
				RustSource._blank(output, index, end);
				index = end;
				continue;
			}
			const raw = RustSource._readRawString(text, index);
			if (raw !== null) {
				stringLiterals.push({ offset: raw.contentStart, text: text.slice(raw.contentStart, raw.contentEnd) });
				RustSource._blank(output, raw.contentStart, raw.contentEnd);
				index = raw.end;
				continue;
			}
			if (character === '"') {
				const contentEnd = RustSource._stringContentEnd(text, index + 1);
				stringLiterals.push({ offset: index + 1, text: text.slice(index + 1, contentEnd) });
				RustSource._blank(output, index + 1, contentEnd);
				index = contentEnd + 1;
				continue;
			}
			if (character === "'") {
				const characterEnd = RustSource._characterLiteralEnd(text, index);
				if (characterEnd !== null) {
					RustSource._blank(output, index + 1, characterEnd - 1);
					index = characterEnd;
					continue;
				}
			}
			index += 1;
		}
		const code = output.join('');
		const testRanges = RustSource._findTestRanges(code);
		const codeWithoutTests = RustSource._blankRanges(code, testRanges);
		const stringLiteralsWithoutTests = stringLiterals.filter((stringLiteral) => {
			return RustSource._isInRanges(stringLiteral.offset, testRanges) === false;
		});
		return {
			code: codeWithoutTests,
			stringLiterals: stringLiteralsWithoutTests,
		};
	}

	/**
	 * Gives the line number of a position in a text.
	 *
	 * @param text - The text.
	 * @param offset - The position in the text.
	 * @returns The line number, starting at 1.
	 */
	static lineNumberOf(text: string, offset: number): number {
		let lineNumber = 1;
		for (let index = 0; index < offset && index < text.length; index += 1) {
			if (text[index] === '\n') {
				lineNumber += 1;
			}
		}
		return lineNumber;
	}

	/**
	 * Gives the text of one line of a file, without its indentation.
	 *
	 * @param text - The text of the file.
	 * @param lineNumber - The line number, starting at 1.
	 * @returns The text of the line.
	 */
	static excerptOf(text: string, lineNumber: number): string {
		const lines = text.split('\n');
		const line = lines[lineNumber - 1];
		if (line === undefined) {
			return '';
		}
		return line.trim();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

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
	 * Replaces several ranges of a text by spaces, except the new lines.
	 *
	 * @param text - The text.
	 * @param ranges - The ranges, each with its first position and the position after its last one.
	 * @returns The new text.
	 */
	private static _blankRanges(text: string, ranges: Array<[number, number]>): string {
		const output = text.split('');
		for (const [start, end] of ranges) {
			RustSource._blank(output, start, end);
		}
		return output.join('');
	}

	/**
	 * Tests whether a position is inside one of the ranges.
	 *
	 * @param offset - The position.
	 * @param ranges - The ranges, each with its first position and the position after its last one.
	 * @returns True when a range holds the position.
	 */
	private static _isInRanges(offset: number, ranges: Array<[number, number]>): boolean {
		for (const [start, end] of ranges) {
			if (offset >= start && offset < end) {
				return true;
			}
		}
		return false;
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
	 * Finds the end of a block comment. A block comment of Rust can hold another block comment.
	 *
	 * @param text - The text.
	 * @param start - The position of the characters that open the comment.
	 * @returns The position after the characters that close the comment, or the length of the text.
	 */
	private static _blockCommentEnd(text: string, start: number): number {
		let depth = 0;
		let index = start;
		while (index < text.length) {
			if (text.startsWith('/*', index)) {
				depth += 1;
				index += 2;
				continue;
			}
			if (text.startsWith('*/', index)) {
				depth -= 1;
				index += 2;
				if (depth === 0) {
					return index;
				}
				continue;
			}
			index += 1;
		}
		return text.length;
	}

	/**
	 * Reads a raw string such as `r"text"` or `r#"text"#`, or a raw byte string.
	 *
	 * @param text - The text.
	 * @param index - The position to test.
	 * @returns The positions of the raw string, or null when no raw string starts here.
	 */
	private static _readRawString(
		text: string,
		index: number,
	): { contentStart: number; contentEnd: number; end: number } | null {
		const previous = text[index - 1];
		if (previous !== undefined && /[A-Za-z0-9_]/.test(previous)) {
			return null;
		}
		const opening = /b?r(#*)"/y;
		opening.lastIndex = index;
		const match = opening.exec(text);
		if (match === null) {
			return null;
		}
		const closing = `"${match[1]}`;
		const contentStart = index + match[0].length;
		const closingIndex = text.indexOf(closing, contentStart);
		if (closingIndex === -1) {
			return {
				contentStart,
				contentEnd: text.length,
				end: text.length,
			};
		}
		return {
			contentStart,
			contentEnd: closingIndex,
			end: closingIndex + closing.length,
		};
	}

	/**
	 * Finds the end of the content of a normal string.
	 *
	 * @param text - The text.
	 * @param start - The position of the first character of the content.
	 * @returns The position of the closing quote, or the length of the text.
	 */
	private static _stringContentEnd(text: string, start: number): number {
		let index = start;
		while (index < text.length) {
			if (text[index] === '\\') {
				index += 2;
				continue;
			}
			if (text[index] === '"') {
				return index;
			}
			index += 1;
		}
		return text.length;
	}

	/**
	 * Tests whether a single quote opens a character literal, and finds its end. A lifetime such as `'a` is not a character
	 * literal.
	 *
	 * @param text - The text.
	 * @param index - The position of the single quote.
	 * @returns The position after the closing single quote, or null when the quote is not a character literal.
	 */
	private static _characterLiteralEnd(text: string, index: number): number | null {
		const literal = /'(?:\\(?:x[0-9a-fA-F]{2}|u\{[0-9a-fA-F_]+\}|.)|[^\\'\n])'/uy;
		literal.lastIndex = index;
		const match = literal.exec(text);
		if (match === null) {
			return null;
		}
		return index + match[0].length;
	}

	/**
	 * Finds the items that only the tests compile: an item after `#[cfg(test)]` or `#[test]`.
	 *
	 * @param code - The code, without comments and string contents.
	 * @returns The ranges of the items, each with its first position and the position after its last one.
	 */
	private static _findTestRanges(code: string): Array<[number, number]> {
		const ranges: Array<[number, number]> = [];
		const attribute = /#\s*\[\s*(?:cfg\s*\(\s*test\s*\)|test)\s*\]/g;
		let match = attribute.exec(code);
		while (match !== null) {
			const end = RustSource._itemEnd(code, match.index + match[0].length);
			ranges.push([match.index, end]);
			attribute.lastIndex = Math.max(end, attribute.lastIndex);
			match = attribute.exec(code);
		}
		return ranges;
	}

	/**
	 * Finds the end of the item that starts at a position: the closing brace of its block, or its semicolon.
	 *
	 * @param code - The code, without comments and string contents.
	 * @param start - The position where the item starts, after its attributes that are already read.
	 * @returns The position after the item.
	 */
	private static _itemEnd(code: string, start: number): number {
		let depth = 0;
		let index = start;
		while (index < code.length) {
			const character = code[index];
			if (character === '(' || character === '[') {
				depth += 1;
			} else if (character === ')' || character === ']') {
				depth -= 1;
			} else if (character === ';' && depth === 0) {
				return index + 1;
			} else if (character === '{' && depth === 0) {
				return RustSource._matchingBrace(code, index);
			}
			index += 1;
		}
		return code.length;
	}

	/**
	 * Finds the closing brace that matches an opening brace.
	 *
	 * @param code - The code, without comments and string contents.
	 * @param openingIndex - The position of the opening brace.
	 * @returns The position after the closing brace, or the length of the code.
	 */
	private static _matchingBrace(code: string, openingIndex: number): number {
		let depth = 0;
		for (let index = openingIndex; index < code.length; index += 1) {
			if (code[index] === '{') {
				depth += 1;
			} else if (code[index] === '}') {
				depth -= 1;
				if (depth === 0) {
					return index + 1;
				}
			}
		}
		return code.length;
	}
}
