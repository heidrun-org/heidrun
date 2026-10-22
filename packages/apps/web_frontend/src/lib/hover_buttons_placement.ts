///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HoverButtonsPlacement — finds a place for the hover buttons that covers no text of the terminal
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The cells of the screen of a terminal, as the placement needs to read them. */
export type PlacementGrid = {
	/** The number of columns of the screen. */
	columns: number;
	/** The number of lines of the screen. */
	rows: number;
	/** Tells whether a cell holds no character. The cell of the cursor counts as not blank. */
	isBlank: (row: number, column: number) => boolean;
};

/** The piece of text that the pointer is over, and the size of the hover buttons that must go near it. */
export type PlacementRequest = {
	/** The line of the piece of text, counted from 0 at the top of the screen. */
	row: number;
	/** The column of the first character of the piece of text. */
	startColumn: number;
	/** The column after the last character of the piece of text. */
	endColumn: number;
	/** The width of the hover buttons, in cells. */
	widthCells: number;
	/** The height of the hover buttons, in lines. */
	heightRows: number;
};

/** The place of the hover buttons. */
export type PlacementResult = {
	/** The line of the top of the hover buttons. */
	row: number;
	/** The column of the left edge of the hover buttons. */
	column: number;
};

/** The farthest cost that a place may have. A place with a higher cost is too far from the piece of text. */
const MAXIMUM_COST = 40;

/** The cost of one line between the hover buttons and the line of the piece of text, in columns. */
const COST_PER_ROW = 4;

/**
 * Finds a place for the hover buttons where every cell is blank. The hover buttons then hide no character, and a drag that
 * starts on the text still selects it.
 */
export class HoverButtonsPlacement {
	/**
	 * Finds the nearest place that is made of blank cells only.
	 *
	 * @param grid - The cells of the screen.
	 * @param request - The piece of text under the pointer, and the size of the hover buttons.
	 * @returns The place, or null when no blank place is near enough. The hover buttons are then not shown, and a ⌘-click on
	 * the text still runs the main action.
	 */
	static find(grid: PlacementGrid, request: PlacementRequest): PlacementResult | null {
		let best: (PlacementResult & { cost: number }) | null = null;
		const firstRow = request.row - request.heightRows;
		const lastRow = request.row + 1;
		for (let row = firstRow; row <= lastRow; row++) {
			if (row < 0 || row + request.heightRows > grid.rows) {
				continue;
			}
			for (let column = 0; column + request.widthCells <= grid.columns; column++) {
				const cost = HoverButtonsPlacement._cost(row, column, request);
				const isBetter = best === null || cost < best.cost;
				if (cost > MAXIMUM_COST || isBetter === false) {
					continue;
				}
				if (HoverButtonsPlacement._isBlankRectangle(grid, row, column, request) === true) {
					best = { row, column, cost };
				}
			}
		}
		return best === null ? null : { row: best.row, column: best.column };
	}

	/**
	 * Measures how far a place is from the piece of text. A place on the line of the text or on a line next to it costs the
	 * number of blank columns between the place and the text, plus a fixed cost for each line of distance.
	 *
	 * @param row - The line of the top of the place.
	 * @param column - The column of the left edge of the place.
	 * @param request - The piece of text under the pointer, and the size of the hover buttons.
	 * @returns The cost. A lower cost is nearer.
	 */
	private static _cost(row: number, column: number, request: PlacementRequest): number {
		const lastRow = row + request.heightRows - 1;
		const rowDistance = request.row < row ? row - request.row : request.row > lastRow ? request.row - lastRow : 0;
		const right = column + request.widthCells;
		const columnDistance = Math.max(0, column - request.endColumn, request.startColumn - right);
		return rowDistance * COST_PER_ROW + columnDistance;
	}

	/**
	 * Tells whether every cell of a place is blank, and whether the place leaves the piece of text itself uncovered.
	 *
	 * @param grid - The cells of the screen.
	 * @param row - The line of the top of the place.
	 * @param column - The column of the left edge of the place.
	 * @param request - The piece of text under the pointer, and the size of the hover buttons.
	 * @returns True when the place covers no character.
	 */
	private static _isBlankRectangle(grid: PlacementGrid, row: number, column: number, request: PlacementRequest): boolean {
		for (let y = row; y < row + request.heightRows; y++) {
			for (let x = column; x < column + request.widthCells; x++) {
				if (grid.isBlank(y, x) === false) {
					return false;
				}
			}
		}
		return true;
	}
}
