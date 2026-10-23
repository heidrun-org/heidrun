import type { Terminal } from '@xterm/xterm';
import { request } from './api';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TerminalSelection — reads selected text from Herdr without visual line breaks
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * An expected reason why Herdr cannot give the original text: the terminal changed during the copy, or the selection goes
 * past the visible rows. The copy then uses the displayed selection without a warning.
 */
class OriginalTextUnavailableError extends Error {}

/**
 * Removes every space and line break, to compare the original text of Herdr with the displayed selection, which has a line
 * break at each visual wrap and may have trailing spaces.
 * @param text - the text to compare
 * @returns the text without spaces and line breaks
 */
function withoutSpaces(text: string): string {
	return text.replace(/\s+/g, '');
}

/** Reads selections only while the displayed terminal content remains unchanged. */
export class TerminalSelection {
	/** Changes whenever output, scrolling, or resizing can change the displayed cells. */
	private _revision = 0;
	/** The number of the last copy. A copy that is not the last one does not replace the clipboard any more. */
	private _copies = 0;

	/** Marks previously captured selection coordinates as outdated. */
	invalidate(): void {
		this._revision++;
	}

	/**
	 * Reads the selected cells from Herdr, which retains the original line boundaries.
	 * @param terminal - the terminal displaying Herdr's current viewport
	 * @param paneId - the pane whose text is selected
	 * @returns selected text with visual wraps joined and intentional line breaks retained
	 */
	async read(terminal: Terminal, paneId: string): Promise<string> {
		const position = terminal.getSelectionPosition();
		if (position === undefined) {
			return '';
		}
		const revision = this._revision;
		const displayed = terminal.getSelection();
		const columns = terminal.cols;
		const rows = terminal.rows;
		const viewport = terminal.buffer.active.viewportY;
		const firstRow = position.start.y - viewport;
		const lastRow = position.end.y - viewport - (position.end.x === 0 ? 1 : 0);
		if (firstRow < 0 || lastRow >= rows || lastRow < firstRow) {
			throw new OriginalTextUnavailableError('Selection is outside the current viewport');
		}
		const displayedLines: string[] = [];
		for (let row = firstRow; row <= lastRow; row++) {
			displayedLines.push(terminal.buffer.active.getLine(row + viewport)?.translateToString(true) ?? '');
		}
		const content = await request<{
			/** Revision of the cells used by Herdr's copy operations. */
			content_revision: number;
		}>('pane.copy_motion', {
			pane_id: paneId,
			cursor: {
				row: firstRow,
				col: position.start.x,
			},
			motion: 'first_non_blank',
		});
		this.throwWhenChanged(revision);
		const visible = await request<{
			/** The viewport text used to verify the displayed selection. */
			read: {
				/** Text with one line per displayed row. */
				text: string;
			};
		}>('pane.read', {
			pane_id: paneId,
			source: 'visible',
		});
		this.throwWhenChanged(revision);
		const remoteLines = visible.read.text.split('\n');
		for (let row = firstRow; row <= lastRow; row++) {
			if (displayedLines[row - firstRow].trimEnd() !== (remoteLines[row] ?? '').trimEnd()) {
				throw new OriginalTextUnavailableError('Displayed selection no longer matches Herdr');
			}
		}
		const result = await request<{
			/** Original selected text returned by Herdr. */
			text: string;
		}>('pane.selection.read', {
			pane_id: paneId,
			content_revision: content.content_revision,
			anchor: {
				row: firstRow,
				col: position.start.x,
			},
			cursor: {
				row: lastRow,
				col: position.end.x === 0 ? columns - 1 : position.end.x - 1,
			},
		});
		if (revision !== this._revision || terminal.cols !== columns || terminal.rows !== rows
			|| JSON.stringify(terminal.getSelectionPosition()) !== JSON.stringify(position)) {
			throw new OriginalTextUnavailableError('Terminal changed while copying');
		}
		// Herdr may read the cells at the same coordinates in another state of the pane, for example its history: the
		// text must be the selected text, apart from the joined wraps and the trailing spaces (issue #805).
		if (withoutSpaces(result.text) !== withoutSpaces(displayed)) {
			throw new Error(`Herdr returned another text than the selection: ${JSON.stringify(result.text)} instead of ${JSON.stringify(displayed)}`);
		}
		return result.text;
	}

	/**
	 * Gives the text to copy: the original text from Herdr when it can be read, otherwise the displayed selection. Output,
	 * scrolling, or a selection outside the visible rows never leaves the developer with nothing to copy (issue #803).
	 * @param terminal - the terminal displaying Herdr's current viewport
	 * @param paneId - the pane whose text is selected
	 * @returns the original selected text, or the displayed selected text when Herdr cannot give it
	 */
	async readForCopy(terminal: Terminal, paneId: string): Promise<string> {
		// Read before the requests: the selection may change or be cleared while Herdr answers.
		const displayed = terminal.getSelection();
		try {
			return await this.read(terminal, paneId);
		} catch (error) {
			// Output during the copy is expected while a coding agent works; any other error means that the original-text
			// path is broken, so it must stay visible in the console.
			if (error instanceof OriginalTextUnavailableError === false) {
				console.warn('Copying the displayed selection, because Herdr could not give the original text:', error);
			}
			if (displayed === '') {
				throw new Error('The selection has no text to copy');
			}
			return displayed;
		}
	}

	/**
	 * Stops a read as soon as the terminal changed, instead of waiting for the next request to Herdr.
	 * @param revision - the revision when the read started
	 */
	private throwWhenChanged(revision: number): void {
		if (revision !== this._revision) {
			throw new OriginalTextUnavailableError('Terminal changed while copying');
		}
	}

	/**
	 * Copies the selection in two steps. The displayed selection goes to the clipboard at once, so that a paste right after
	 * the copy already gets it. Then, when Herdr gives the original text and it is the selected text, the original text
	 * replaces it, with the visual wraps joined (issue #805).
	 * @param terminal - the terminal displaying Herdr's current viewport
	 * @param paneId - the pane whose text is selected
	 * @param write - writes a text to the clipboard, and rejects when it cannot
	 * @returns nothing; rejects when the selection has no text or when the first write fails
	 */
	async copy(terminal: Terminal, paneId: string, write: (text: string) => Promise<void>): Promise<void> {
		const displayed = terminal.getSelection();
		if (displayed === '') {
			throw new Error('The selection has no text to copy');
		}
		this._copies++;
		const copy = this._copies;
		await write(displayed);
		const original = await this.readForCopy(terminal, paneId);
		// A newer copy already wrote its own text: the original text of this one must not replace it.
		if (original === displayed || copy !== this._copies) {
			return;
		}
		await write(original).catch((error: unknown) => {
			console.warn('The original text could not replace the displayed selection in the clipboard:', error);
		});
	}
}
