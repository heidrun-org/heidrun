///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WrappedLines — finds and joins the screen lines that a coding agent wrapped itself
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One screen line of a logical line: where its text starts on the screen, and where it sits in the joined text. */
export type WrappedLineSegment = {
	/** The index of the screen line. */
	row: number;
	/** The index, in the text of the screen line, of the first character that the joined text keeps. */
	column: number;
	/** The index, in the joined text, of that first character. */
	offset: number;
	/** The number of characters of the screen line that the joined text keeps. */
	length: number;
};

/** Several screen lines that a coding agent wrapped, read as the one line that the agent wrote. */
export type LogicalLine = {
	/** The index of the first screen line. */
	first: number;
	/** The index of the last screen line. */
	last: number;
	/** The text of the screen lines, joined. */
	text: string;
	/**
	 * True when the last screen line is the last line of the screen: the text may go on below it, out of sight, so a command
	 * that reaches the end of the text may be cut.
	 */
	isCutAtBottom: boolean;
	/** Each screen line, in order. */
	segments: WrappedLineSegment[];
};

/**
 * Claude Code and Codex write their own line breaks when a line is wider than the pane, so Herdr cannot tell them from the
 * real ones (issue #574). They wrap in two ways. At a space, when the next word does not fit: the line ends before the
 * right edge, and the join needs one space. Inside a word, when the word is longer than the room left, for example a long
 * path: the line reaches the right edge, and the join needs no space. A continuation line has the indentation of the agent,
 * which the join removes.
 */
export class WrappedLines {
	/** The most screen lines of one logical line. A longer one is not read at all, rather than cut. */
	static readonly MAX_ROWS = 50;

	/**
	 * Tells whether the agent wrapped `previous` into `next`: the first word of `next` did not fit at the end of `previous`.
	 *
	 * @param previous - The text of a screen line.
	 * @param next - The text of the screen line under it.
	 * @param columns - The number of columns of the pane.
	 * @returns True when `next` goes on the line of `previous`.
	 */
	static isWrapped(previous: string, next: string, columns: number): boolean {
		const previousLength = previous.trimEnd().length;
		const nextText = next.trim();
		if (previousLength === 0 || nextText === '') {
			return false;
		}
		if (WrappedLines.reachesEdge(previous, columns) === true) {
			return true;
		}
		const firstWord = nextText.split(/\s/)[0];
		// A word longer than a whole line would have been cut at the end of `previous`, which then reaches the edge: here it
		// starts a new line.
		if (firstWord.length >= columns - (next.length - next.trimStart().length)) {
			return false;
		}
		return previousLength + 1 + firstWord.length > columns;
	}

	/**
	 * Tells whether a screen line reaches the right edge of the pane: the agent cut a word in two there.
	 *
	 * @param line - The text of a screen line.
	 * @param columns - The number of columns of the pane.
	 * @returns True when the line goes up to the last column, or to the one before it.
	 */
	static reachesEdge(line: string, columns: number): boolean {
		return line.trimEnd().length >= columns - 1;
	}

	/**
	 * Gives what goes between the text of a screen line and the text of the next one, when the agent wrapped it.
	 *
	 * @param previous - The text of the screen line that the agent wrapped.
	 * @param columns - The number of columns of the pane.
	 * @returns No space after a word cut at the right edge, one space otherwise.
	 */
	static separator(previous: string, columns: number): string {
		return WrappedLines.reachesEdge(previous, columns) === true ? '' : ' ';
	}

	/**
	 * Reads the logical line that holds a screen line: the screen lines above and under it that the agent wrapped into it.
	 *
	 * @param lineAt - Returns the text of a screen line, or null past the screen.
	 * @param row - The index of the screen line.
	 * @param columns - The number of columns of the pane.
	 * @returns The logical line, or null when the screen line does not exist or the logical line has more than `MAX_ROWS` lines,
	 * or may have more above the top of the screen.
	 */
	static logicalLine(lineAt: (index: number) => string | null, row: number, columns: number): LogicalLine | null {
		if (lineAt(row) === null) {
			return null;
		}
		let first = row;
		while (first > 0 && row - first <= WrappedLines.MAX_ROWS) {
			const above = lineAt(first - 1);
			const current = lineAt(first);
			if (above === null || current === null || WrappedLines.isWrapped(above, current, columns) === false) {
				break;
			}
			first--;
		}
		let last = row;
		while (last - first <= WrappedLines.MAX_ROWS) {
			const current = lineAt(last);
			const below = lineAt(last + 1);
			if (current === null || below === null || WrappedLines.isWrapped(current, below, columns) === false) {
				break;
			}
			last++;
		}
		if (last - first + 1 > WrappedLines.MAX_ROWS) {
			return null;
		}
		let text = '';
		const segments: WrappedLineSegment[] = [];
		for (let index = first; index <= last; index++) {
			const line = (lineAt(index) ?? '').trimEnd();
			const column = index === first ? 0 : line.length - line.trimStart().length;
			if (index > first) {
				text += WrappedLines.separator(lineAt(index - 1) ?? '', columns);
			}
			segments.push({ row: index, column, offset: text.length, length: line.length - column });
			text += line.slice(column);
		}
		return { first, last, text, segments, isCutAtBottom: lineAt(last + 1) === null };
	}
}
