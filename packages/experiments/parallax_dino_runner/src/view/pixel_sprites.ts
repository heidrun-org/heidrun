///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PixelSprites — draws a pixel picture on the canvas
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws a pixel picture. A picture is a list of rows of text, and the palette gives a color to each symbol.
 */
export class PixelSprites {
	/**
	 * Draws a picture. A row draws one rectangle for each run of the same symbol.
	 * @param context The drawing context of the canvas.
	 * @param rows The rows of the picture. A symbol that the palette does not know draws nothing.
	 * @param palette The color of each symbol.
	 * @param left The left edge of the picture, in design units.
	 * @param top The top edge of the picture, in design units.
	 * @param cell The size of one pixel of the picture, in design units.
	 */
	static draw(
		context: CanvasRenderingContext2D,
		rows: readonly string[],
		palette: ReadonlyMap<string, string>,
		left: number,
		top: number,
		cell: number,
	): void {
		for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
			const row = rows[rowIndex];
			let columnIndex = 0;
			while (columnIndex < row.length) {
				const symbol = row[columnIndex];
				const color = palette.get(symbol);
				let endIndex = columnIndex;
				while (endIndex + 1 < row.length && row[endIndex + 1] === symbol) {
					endIndex += 1;
				}
				if (color !== undefined) {
					context.fillStyle = color;
					const x = left + columnIndex * cell;
					const width = (endIndex - columnIndex + 1) * cell;
					context.fillRect(x, top + rowIndex * cell, width, cell + 0.5);
				}
				columnIndex = endIndex + 1;
			}
		}
	}
}
