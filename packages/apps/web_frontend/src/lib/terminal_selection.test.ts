import type { Terminal } from '@xterm/xterm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './api';
import { TerminalSelection } from './terminal_selection';

vi.mock('./api', () => ({
	request: vi.fn(),
}));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TerminalSelection — verifies original line boundaries and selection validity
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Builds only the terminal surface needed by selection reading. */
class SelectionFixture {
	/** The visible rows, with a wrapped line followed by two intentional lines. */
	lines = ['command --long-', 'option', 'FIRST', 'SECOND'];
	/** Selected cells use xterm's exclusive end column. */
	position = {
		start: {
			x: 0,
			y: 0,
		},
		end: {
			x: 6,
			y: 1,
		},
	};
	/** The terminal test surface. */
	terminal = {
		cols: 15,
		rows: 4,
		getSelectionPosition: () => this.position,
		buffer: {
			active: {
				viewportY: 0,
				getLine: (row: number) => ({
					translateToString: () => this.lines[row] ?? '',
				}),
			},
		},
	} as unknown as Terminal;

	/**
	 * Supplies the real response shapes of Herdr's two read operations.
	 * @param text - the original selected text
	 * @returns nothing
	 */
	respond(text: string): void {
		vi.mocked(request).mockResolvedValueOnce({
			content_revision: 42,
		}).mockResolvedValueOnce({
			read: {
				text: this.lines.join('\n'),
				revision: 0,
			},
		}).mockResolvedValueOnce({
			text,
		});
	}
}

describe('TerminalSelection', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('copies wrapped rows through Herdr instead of inserting a newline', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1'))
			.resolves.toBe('command --long-option');
		expect(request).toHaveBeenLastCalledWith('pane.selection.read', {
			pane_id: 'w1:p1',
			content_revision: 42,
			anchor: {
				row: 0,
				col: 0,
			},
			cursor: {
				row: 1,
				col: 5,
			},
		});
	});

	it('retains intentional line breaks and Unicode without rewriting text', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('écho 界\nSECOND');
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1'))
			.resolves.toBe('écho 界\nSECOND');
	});

	it('maps an end at the next row start to the previous row final cell', async () => {
		const fixture = new SelectionFixture();
		fixture.position.end = {
			x: 0,
			y: 2,
		};
		fixture.respond('command --long-option');
		await new TerminalSelection().read(fixture.terminal, 'w1:p1');
		expect(vi.mocked(request).mock.calls[2][1]?.cursor).toEqual({
			row: 1,
			col: 14,
		});
	});

	it('uses the displayed rows after Herdr scrolls the viewport', async () => {
		const fixture = new SelectionFixture();
		fixture.lines = ['older command', 'continued', 'FIRST', 'SECOND'];
		fixture.respond('older commandcontinued');
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1'))
			.resolves.toBe('older commandcontinued');
	});

	it('rejects a viewport that differs from the selected displayed rows', async () => {
		const fixture = new SelectionFixture();
		vi.mocked(request).mockResolvedValueOnce({
			content_revision: 42,
		}).mockResolvedValueOnce({
			read: {
				text: 'different command\noption',
				revision: 43,
			},
		});
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1')).rejects.toThrow('no longer matches');
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('rejects output or scrolling received while a copy is in progress', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		const selection = new TerminalSelection();
		const pending = selection.read(fixture.terminal, 'w1:p1');
		selection.invalidate();
		await expect(pending).rejects.toThrow('Terminal changed');
	});

	it('rejects a changed selection while a copy is in progress', async () => {
		const fixture = new SelectionFixture();
		fixture.respond('command --long-option');
		const pending = new TerminalSelection().read(fixture.terminal, 'w1:p1');
		fixture.position = {
			...fixture.position,
			end: {
				x: 3,
				y: 1,
			},
		};
		await expect(pending).rejects.toThrow('Terminal changed');
	});

	it('does not silently copy broken text when Herdr refuses a stale content revision', async () => {
		const fixture = new SelectionFixture();
		vi.mocked(request).mockResolvedValueOnce({
			content_revision: 42,
		}).mockResolvedValueOnce({
			read: {
				text: fixture.lines.join('\n'),
				revision: 0,
			},
		}).mockRejectedValueOnce(new Error('stale_content'));
		await expect(new TerminalSelection().read(fixture.terminal, 'w1:p1')).rejects.toThrow('stale_content');
	});
});
