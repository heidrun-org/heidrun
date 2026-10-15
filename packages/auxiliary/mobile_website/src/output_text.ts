///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	OutputText — makes the output of a pane short enough to read on a phone
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The output of a pane is a copy of a terminal screen, so it holds many empty lines. A phone has no room for them.
 */
export class OutputText {
	/**
	 * Removes the spaces at the end of each line, replaces each group of empty lines by one empty line, and removes
	 * the empty lines at the start and at the end.
	 * @param text The output of the pane, as the Mac sends it.
	 * @returns The same output with fewer empty lines.
	 */
	static tidy(text: string): string {
		const lines: string[] = [];
		for (const line of text.split('\n')) {
			const trimmedLine = line.replace(/\s+$/, '');
			const isEmpty = trimmedLine === '';
			const previousLine = lines[lines.length - 1];
			if (isEmpty && (previousLine === undefined || previousLine === '')) {
				continue;
			}
			lines.push(trimmedLine);
		}
		while (lines.length > 0 && lines[lines.length - 1] === '') {
			lines.pop();
		}
		return lines.join('\n');
	}
}
