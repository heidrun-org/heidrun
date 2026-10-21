import type { Terminal } from '@xterm/xterm';
import { request } from './api';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TerminalSelection — reads selected text from Herdr without visual line breaks
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Reads selections only while the displayed terminal content remains unchanged. */
export class TerminalSelection {
	/** Changes whenever output, scrolling, or resizing can change the displayed cells. */
	private _revision = 0;

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
		const columns = terminal.cols;
		const rows = terminal.rows;
		const viewport = terminal.buffer.active.viewportY;
		const firstRow = position.start.y - viewport;
		const lastRow = position.end.y - viewport - (position.end.x === 0 ? 1 : 0);
		if (firstRow < 0 || lastRow >= rows || lastRow < firstRow) {
			throw new Error('Selection is outside the current viewport');
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
		const remoteLines = visible.read.text.split('\n');
		for (let row = firstRow; row <= lastRow; row++) {
			if (displayedLines[row - firstRow].trimEnd() !== (remoteLines[row] ?? '').trimEnd()) {
				throw new Error('Displayed selection no longer matches Herdr');
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
			throw new Error('Terminal changed while copying');
		}
		return result.text;
	}
}
