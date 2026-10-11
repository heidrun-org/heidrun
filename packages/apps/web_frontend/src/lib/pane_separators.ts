import type { LayoutSplit, PaneLayoutSnapshot, Rect } from './types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneSeparators — finds the lines between panes and the corners where lines meet, from the splits of Herdr
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One line between two groups of panes. The user drags it to change the size of the groups. */
export type PaneSeparator = {
	/** Name of the split in Herdr, for example `split_1_0`. */
	splitId: string;
	/** `down`: a horizontal line, the groups sit one above the other. `right`: a vertical line, side by side. */
	direction: 'down' | 'right';
	/** Where the line is, in cells, on the axis that the line moves on: `y` for `down`, `x` for `right`. */
	position: number;
	/** Where the line starts, in cells, along its length. */
	start: number;
	/** Where the line ends, in cells, along its length. */
	end: number;
	/** Where the rectangle of the split starts, in cells, on the axis that the line moves on. */
	origin: number;
	/** Size of the rectangle of the split, in cells, on the axis that the line moves on. */
	size: number;
	/** Share of the rectangle that the first group (the top or the left one) takes, from 0 to 1. */
	ratio: number;
	/** The way from the root of the layout to the split: `false` goes to the first group, `true` to the second. */
	path: boolean[];
};

/** One side of the area of the panes where a column of the window sits against the panes. */
export type PaneOuterEdge = 'left' | 'right';

/** The sides of the area of the panes that have a column of the window against them. */
export type PaneOuterEdges = {
	/** True when the sidebar sits against the left side. */
	left: boolean;
	/** True when the dock column or the right panel sits against the right side. */
	right: boolean;
};

/** A point where several lines meet. One drag on the point moves all of these lines. */
export type PaneCorner = {
	/** Where the point is, in cells, from the left of the area. */
	x: number;
	/** Where the point is, in cells, from the top of the area. */
	y: number;
	/** The horizontal lines that end or cross at the point. */
	horizontalSeparators: PaneSeparator[];
	/** The vertical lines that end or cross at the point. */
	verticalSeparators: PaneSeparator[];
	/** The side of the area where the point is, when a column of the window sits there, else `null`. */
	outerEdge: PaneOuterEdge | null;
};

/** Geometry of the lines between panes, and of the corners where lines meet. It reads the splits that Herdr sends. */
export class PaneSeparators {
	/**
	 * Finds the line of every split of a layout.
	 *
	 * @param layout - The layout of a tab, as Herdr sends it.
	 * @returns The lines. The list is empty when a pane is zoomed, or when Herdr sends no split.
	 */
	static findSeparators(layout: PaneLayoutSnapshot): PaneSeparator[] {
		const splitList = layout.splits ?? [];
		if (layout.zoomed === true || splitList.length === 0) {
			return [];
		}
		const separatorList: PaneSeparator[] = [];
		for (const split of splitList) {
			const separator = PaneSeparators._buildSeparator(layout, splitList, split);
			if (separator !== null) {
				separatorList.push(separator);
			}
		}
		return separatorList;
	}

	/**
	 * Finds the points where lines meet each other, and the points where a horizontal line reaches a side of the
	 * area that has a column of the window against it.
	 *
	 * @param separatorList - The lines of the layout.
	 * @param area - The area of the layout, in cells.
	 * @param outerEdges - The sides of the area that have a column of the window against them.
	 * @returns The corners. Lines that meet at the same point share one corner.
	 */
	static findCorners(separatorList: PaneSeparator[], area: Rect, outerEdges: PaneOuterEdges): PaneCorner[] {
		const cornerMap = new Map<string, PaneCorner>();
		const horizontalList = separatorList.filter((separator) => separator.direction === 'down');
		const verticalList = separatorList.filter((separator) => separator.direction === 'right');
		for (const horizontal of horizontalList) {
			for (const vertical of verticalList) {
				const isTouching =
					vertical.position >= horizontal.start &&
					vertical.position <= horizontal.end &&
					horizontal.position >= vertical.start &&
					horizontal.position <= vertical.end;
				if (isTouching === false) {
					continue;
				}
				const corner = PaneSeparators._getCorner(cornerMap, vertical.position, horizontal.position, null);
				PaneSeparators._addOnce(corner.horizontalSeparators, horizontal);
				PaneSeparators._addOnce(corner.verticalSeparators, vertical);
			}
			if (outerEdges.left === true && horizontal.start === area.x) {
				const corner = PaneSeparators._getCorner(cornerMap, area.x, horizontal.position, 'left');
				PaneSeparators._addOnce(corner.horizontalSeparators, horizontal);
			}
			if (outerEdges.right === true && horizontal.end === area.x + area.width) {
				const corner = PaneSeparators._getCorner(cornerMap, area.x + area.width, horizontal.position, 'right');
				PaneSeparators._addOnce(corner.horizontalSeparators, horizontal);
			}
		}
		return [...cornerMap.values()];
	}

	/**
	 * Computes the share that the first group takes after the line moves.
	 *
	 * @param separator - The line, with its share before the move.
	 * @param deltaCells - How far the line moves, in cells. Down or right is positive.
	 * @returns The new share, from 0 to 1. Herdr keeps the share of a split between 0.1 and 0.9.
	 */
	static moveRatio(separator: PaneSeparator, deltaCells: number): number {
		const ratio = separator.ratio + deltaCells / separator.size;
		return Math.min(1, Math.max(0, ratio));
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Builds the line of one split.
	 *
	 * The position of the line comes from the edges of the panes, not from the ratio, because Herdr rounds the
	 * panes to whole cells and the rounding of the ratio can differ by one cell.
	 *
	 * @param layout - The layout of the tab.
	 * @param splitList - Every split of the layout.
	 * @param split - The split to build the line of.
	 * @returns The line, or `null` when the panes do not show a clean cut for the split.
	 */
	private static _buildSeparator(
		layout: PaneLayoutSnapshot,
		splitList: LayoutSplit[],
		split: LayoutSplit,
	): PaneSeparator | null {
		const isHorizontal = split.direction === 'down';
		const origin = isHorizontal ? split.rect.y : split.rect.x;
		const size = isHorizontal ? split.rect.height : split.rect.width;
		if (size <= 0) {
			return null;
		}
		const paneRectList = layout.panes
			.map((layoutPane) => layoutPane.rect)
			.filter((paneRect) => PaneSeparators._contains(split.rect, paneRect));
		const expected = origin + size * split.ratio;
		let position: number | null = null;
		for (const paneRect of paneRectList) {
			const candidate = isHorizontal ? paneRect.y : paneRect.x;
			if (candidate <= origin) {
				continue;
			}
			const isCleanCut = paneRectList.every((otherRect) => {
				const otherStart = isHorizontal ? otherRect.y : otherRect.x;
				const otherEnd = otherStart + (isHorizontal ? otherRect.height : otherRect.width);
				return otherEnd <= candidate || otherStart >= candidate;
			});
			if (isCleanCut === false) {
				continue;
			}
			if (position === null || Math.abs(candidate - expected) < Math.abs(position - expected)) {
				position = candidate;
			}
		}
		if (position === null) {
			return null;
		}
		const separator: PaneSeparator = {
			splitId: split.id,
			direction: split.direction,
			position,
			start: isHorizontal ? split.rect.x : split.rect.y,
			end: isHorizontal ? split.rect.x + split.rect.width : split.rect.y + split.rect.height,
			origin,
			size,
			ratio: split.ratio,
			path: PaneSeparators._findPath(splitList, split),
		};
		return separator;
	}

	/**
	 * Finds the way from the root of the layout to a split. Herdr gives the split with the whole layout as a flat
	 * list, so the way comes from the rectangles: the parent of a split is the smallest split that contains it.
	 *
	 * @param splitList - Every split of the layout.
	 * @param target - The split to find the way to.
	 * @returns The way: `false` goes to the first group of a split, `true` to the second. Empty for the root.
	 */
	private static _findPath(splitList: LayoutSplit[], target: LayoutSplit): boolean[] {
		const path: boolean[] = [];
		let current = target;
		while (true) {
			const parent = PaneSeparators._findParent(splitList, current);
			if (parent === null) {
				return path;
			}
			const isSecond = parent.direction === 'down' ? current.rect.y > parent.rect.y : current.rect.x > parent.rect.x;
			path.unshift(isSecond);
			current = parent;
		}
	}

	/**
	 * Finds the smallest split whose rectangle contains the rectangle of another split.
	 *
	 * @param splitList - Every split of the layout.
	 * @param child - The split to find the parent of.
	 * @returns The parent, or `null` for the root.
	 */
	private static _findParent(splitList: LayoutSplit[], child: LayoutSplit): LayoutSplit | null {
		const childArea = child.rect.width * child.rect.height;
		let parent: LayoutSplit | null = null;
		let parentArea = Infinity;
		for (const candidate of splitList) {
			const candidateArea = candidate.rect.width * candidate.rect.height;
			if (candidate.id === child.id || candidateArea <= childArea || candidateArea >= parentArea) {
				continue;
			}
			if (PaneSeparators._contains(candidate.rect, child.rect) === false) {
				continue;
			}
			parent = candidate;
			parentArea = candidateArea;
		}
		return parent;
	}

	/**
	 * Tests that a rectangle lies inside another rectangle.
	 *
	 * @param outer - The rectangle that may contain the other one.
	 * @param inner - The rectangle that may lie inside.
	 * @returns True when every side of the inner rectangle is inside, or on a side of, the outer rectangle.
	 */
	private static _contains(outer: Rect, inner: Rect): boolean {
		return (
			inner.x >= outer.x &&
			inner.y >= outer.y &&
			inner.x + inner.width <= outer.x + outer.width &&
			inner.y + inner.height <= outer.y + outer.height
		);
	}

	/**
	 * Gets the corner at a point, and creates it when it does not exist yet.
	 *
	 * @param cornerMap - The corners found so far, by point.
	 * @param x - Where the point is, in cells, from the left of the area.
	 * @param y - Where the point is, in cells, from the top of the area.
	 * @param outerEdge - The side of the area where the point is, or `null` inside the area.
	 * @returns The corner.
	 */
	private static _getCorner(
		cornerMap: Map<string, PaneCorner>,
		x: number,
		y: number,
		outerEdge: PaneOuterEdge | null,
	): PaneCorner {
		const key = `${outerEdge ?? 'inside'}:${x}:${y}`;
		const existing = cornerMap.get(key);
		if (existing !== undefined) {
			return existing;
		}
		const corner: PaneCorner = {
			x,
			y,
			horizontalSeparators: [],
			verticalSeparators: [],
			outerEdge,
		};
		cornerMap.set(key, corner);
		return corner;
	}

	/**
	 * Adds a line to a list when the list does not hold it yet.
	 *
	 * @param separatorList - The list to add to.
	 * @param separator - The line to add.
	 */
	private static _addOnce(separatorList: PaneSeparator[], separator: PaneSeparator): void {
		if (separatorList.includes(separator) === false) {
			separatorList.push(separator);
		}
	}
}
