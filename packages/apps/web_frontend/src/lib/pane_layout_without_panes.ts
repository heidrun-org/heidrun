import { PaneSeparators, type PaneSeparator } from './pane_separators';
import type { LayoutSplit, PaneLayoutSnapshot, Rect } from './types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneLayoutWithoutPanes — the layout of a tab after some of its panes leave the grid
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One pane of a layout, as Herdr sends it. */
type LayoutPane = PaneLayoutSnapshot['panes'][number];

/** One pane at the end of a branch of the tree of a layout. */
type PaneLeaf = {
	/** Tells a pane from a split. */
	kind: 'pane';
	/** Name of the pane in Herdr, for example `w1:p1`. */
	paneId: string;
};

/** One split of the tree of a layout, with the two groups of panes that it divides. */
type SplitNode = {
	/** Tells a split from a pane. */
	kind: 'split';
	/** The line of the split, with its way from the root of the layout in Herdr. */
	separator: PaneSeparator;
	/** The group on the top or on the left. */
	first: LayoutNode;
	/** The group on the bottom or on the right. */
	second: LayoutNode;
};

/** A pane, or a split of two groups of panes. */
type LayoutNode = PaneLeaf | SplitNode;

/**
 * Computes the layout of a tab without some of its panes. A split that loses one of its two groups disappears, and
 * the other group takes the whole rectangle of the split. The share of every split that stays does not change.
 */
export class PaneLayoutWithoutPanes {
	/**
	 * Removes panes from a layout.
	 *
	 * @param layout - The layout of a tab, as Herdr sends it.
	 * @param removedPaneIds - The names of the panes to remove. A name that is not in the layout is ignored.
	 * @returns The layout without these panes. It is the same object when no pane of the layout is removed. It is
	 * `null` when the splits do not describe the panes, for example with a Herdr server that sends no split. The
	 * splits that stay carry the way that they have in the layout of Herdr, in the field `path`.
	 */
	static remove(layout: PaneLayoutSnapshot, removedPaneIds: string[]): PaneLayoutSnapshot | null {
		const removedSet = new Set(removedPaneIds);
		const keptPaneList = layout.panes.filter((layoutPane) => removedSet.has(layoutPane.pane_id) === false);
		if (keptPaneList.length === layout.panes.length) {
			return layout;
		}
		if (keptPaneList.length === 0) {
			const emptyLayout: PaneLayoutSnapshot = {
				...layout,
				panes: [],
				splits: [],
			};
			return emptyLayout;
		}
		if (layout.zoomed === true) {
			const zoomedLayout: PaneLayoutSnapshot = {
				...layout,
				panes: keptPaneList,
			};
			return zoomedLayout;
		}
		const separatorList = PaneSeparators.findSeparators(layout);
		const tree = PaneLayoutWithoutPanes._buildTree(separatorList, [], layout.panes);
		if (tree === null) {
			return null;
		}
		const keptTree = PaneLayoutWithoutPanes._keepPanes(tree, removedSet);
		if (keptTree === null) {
			return null;
		}
		const rectByPaneId = new Map<string, Rect>();
		const splitById = new Map<string, LayoutSplit>();
		PaneLayoutWithoutPanes._placeTree(keptTree, layout.area, rectByPaneId, splitById);
		const reducedLayout: PaneLayoutSnapshot = {
			...layout,
			panes: keptPaneList.map((layoutPane) => {
				return {
					...layoutPane,
					rect: rectByPaneId.get(layoutPane.pane_id) ?? layoutPane.rect,
				};
			}),
			splits: (layout.splits ?? []).flatMap((split) => {
				const placedSplit = splitById.get(split.id);
				return placedSplit === undefined ? [] : [placedSplit];
			}),
		};
		return reducedLayout;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Builds the tree of a layout from its lines and its panes.
	 *
	 * @param separatorList - The lines of the layout, each with its way from the root.
	 * @param path - The way from the root to the group that this call builds. Empty for the whole layout.
	 * @param paneList - The panes of this group.
	 * @returns The tree of the group, or `null` when the lines do not cut the panes into one pane at each end.
	 */
	private static _buildTree(
		separatorList: PaneSeparator[],
		path: boolean[],
		paneList: LayoutPane[],
	): LayoutNode | null {
		const separator = separatorList.find((item) => PaneLayoutWithoutPanes._isSamePath(item.path, path));
		if (separator === undefined) {
			if (paneList.length !== 1) {
				return null;
			}
			const leaf: PaneLeaf = {
				kind: 'pane',
				paneId: paneList[0].pane_id,
			};
			return leaf;
		}
		const isHorizontal = separator.direction === 'down';
		const startOf = (layoutPane: LayoutPane): number => (isHorizontal ? layoutPane.rect.y : layoutPane.rect.x);
		const firstPaneList = paneList.filter((layoutPane) => startOf(layoutPane) < separator.position);
		const secondPaneList = paneList.filter((layoutPane) => startOf(layoutPane) >= separator.position);
		if (firstPaneList.length === 0 || secondPaneList.length === 0) {
			return null;
		}
		const first = PaneLayoutWithoutPanes._buildTree(separatorList, [...path, false], firstPaneList);
		const second = PaneLayoutWithoutPanes._buildTree(separatorList, [...path, true], secondPaneList);
		if (first === null || second === null) {
			return null;
		}
		const split: SplitNode = {
			kind: 'split',
			separator,
			first,
			second,
		};
		return split;
	}

	/**
	 * Cuts the panes that leave out of a tree. A split that keeps only one group is replaced by that group.
	 *
	 * @param node - The tree to cut.
	 * @param removedSet - The names of the panes that leave.
	 * @returns The tree that stays, or `null` when no pane stays.
	 */
	private static _keepPanes(node: LayoutNode, removedSet: Set<string>): LayoutNode | null {
		if (node.kind === 'pane') {
			return removedSet.has(node.paneId) ? null : node;
		}
		const first = PaneLayoutWithoutPanes._keepPanes(node.first, removedSet);
		const second = PaneLayoutWithoutPanes._keepPanes(node.second, removedSet);
		if (first === null || second === null) {
			return first ?? second;
		}
		const split: SplitNode = {
			kind: 'split',
			separator: node.separator,
			first,
			second,
		};
		return split;
	}

	/**
	 * Gives a rectangle to every pane and every split of a tree. A split gives its first group the share of its
	 * rectangle that its ratio says, rounded to a whole cell, and the second group gets the rest.
	 *
	 * @param node - The tree to place.
	 * @param rect - The rectangle of this tree, in cells.
	 * @param rectByPaneId - Receives the rectangle of every pane.
	 * @param splitById - Receives every split, with its new rectangle and its way in the layout of Herdr.
	 */
	private static _placeTree(
		node: LayoutNode,
		rect: Rect,
		rectByPaneId: Map<string, Rect>,
		splitById: Map<string, LayoutSplit>,
	): void {
		if (node.kind === 'pane') {
			rectByPaneId.set(node.paneId, rect);
			return;
		}
		const { separator } = node;
		const isHorizontal = separator.direction === 'down';
		const total = isHorizontal ? rect.height : rect.width;
		const firstSize = Math.round(total * separator.ratio);
		const firstRect: Rect = isHorizontal
			? {
					...rect,
					height: firstSize,
				}
			: {
					...rect,
					width: firstSize,
				};
		const secondRect: Rect = isHorizontal
			? {
					...rect,
					y: rect.y + firstSize,
					height: total - firstSize,
				}
			: {
					...rect,
					x: rect.x + firstSize,
					width: total - firstSize,
				};
		splitById.set(separator.splitId, {
			id: separator.splitId,
			direction: separator.direction,
			ratio: separator.ratio,
			rect,
			path: separator.path,
		});
		PaneLayoutWithoutPanes._placeTree(node.first, firstRect, rectByPaneId, splitById);
		PaneLayoutWithoutPanes._placeTree(node.second, secondRect, rectByPaneId, splitById);
	}

	/**
	 * Tests that two ways from the root are the same.
	 *
	 * @param left - The first way.
	 * @param right - The second way.
	 * @returns True when both ways go to the same group at every step.
	 */
	private static _isSamePath(left: boolean[], right: boolean[]): boolean {
		return left.length === right.length && left.every((isSecond, index) => isSecond === right[index]);
	}
}
