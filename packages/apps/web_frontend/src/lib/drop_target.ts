import { getCurrentWindow } from '@tauri-apps/api/window';
import { reactive } from 'vue';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DropTarget — finds the composition bar that receives a drop of files
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** A point of the window, as the desktop application reports it for a drop of files. */
export type DropPosition = {
	/** The distance from the left edge of the window, in points. */
	x: number;
	/** The distance from the top edge of the window, in points, including the title bar. */
	y: number;
};

/** What the window shows while the developer drags files over it. */
export type DropTargetState = {
	/** The identifier of the pane whose composition bar is under the pointer during a drag, or null. */
	hoveredPaneId: string | null;
};

/** The attribute that each open composition bar carries. Its value is the identifier of the pane of the composition bar. */
export const COMPOSITION_BAR_PANE_ID_ATTRIBUTE = 'data-composition-bar-pane-id';

/** Finds the composition bar that receives a drop of files, and tells which composition bar is under a drag. */
export class DropTarget {
	/** The composition bar under the pointer during a drag of files: it shows that a drop goes there. */
	static readonly state = reactive<DropTargetState>({
		hoveredPaneId: null,
	});

	/**
	 * The height of the title bar, in points: the desktop application counts the height of a drop from the top edge of the
	 * window, but the page starts below the title bar. `measureTopInset` sets it.
	 */
	static topInsetPoints = 0;

	/**
	 * Finds the open composition bar under the point of a drop. Only an open composition bar receives a drop: a drop on
	 * any other part of the window, including a pane with a closed composition bar, has no target.
	 * @param position The point of the drop, as the desktop application reports it.
	 * @param zoomFactor The zoom factor of the web view: each pixel of the page covers this many points of the window.
	 * @returns The identifier of the pane that owns the composition bar under the point, or null when no composition bar
	 * is under the point.
	 */
	static paneIdAt(position: DropPosition, zoomFactor: number): string | null {
		const point = DropTarget.toPagePoint(position, zoomFactor);
		const element = document.elementFromPoint(point.x, point.y);
		if (element === null) {
			return null;
		}
		const compositionBarElement = element.closest(`[${COMPOSITION_BAR_PANE_ID_ATTRIBUTE}]`);
		if (compositionBarElement === null) {
			return null;
		}
		return compositionBarElement.getAttribute(COMPOSITION_BAR_PANE_ID_ATTRIBUTE);
	}

	/**
	 * Records the composition bar under a drag of files, so that this composition bar shows that a drop goes there.
	 * @param position The point of the drag, as `paneIdAt` expects it.
	 * @param zoomFactor The zoom factor of the web view.
	 */
	static hover(position: DropPosition, zoomFactor: number): void {
		DropTarget.state.hoveredPaneId = DropTarget.paneIdAt(position, zoomFactor);
	}

	/** Forgets the composition bar under a drag, because the drag left the window or ended with a drop. */
	static clearHover(): void {
		DropTarget.state.hoveredPaneId = null;
	}

	/**
	 * Measures the height of the title bar: the window is taller than the page by this height. When the measure fails,
	 * the height is 0, so a drop is looked up with the point as reported.
	 * @param zoomFactor The zoom factor of the web view.
	 * @returns Resolves after `topInsetPoints` holds the new height.
	 */
	static async measureTopInset(zoomFactor: number): Promise<void> {
		try {
			const currentWindow = getCurrentWindow();
			const [size, scaleFactor] = await Promise.all([currentWindow.innerSize(), currentWindow.scaleFactor()]);
			const windowHeightPoints = size.height / scaleFactor;
			DropTarget.topInsetPoints = Math.max(0, Math.round(windowHeightPoints - window.innerHeight * zoomFactor));
		} catch {
			DropTarget.topInsetPoints = 0;
		}
	}

	/**
	 * Turns the point of a drag into a point of the page.
	 * @param position The point of the drag, as the desktop application reports it.
	 * @param zoomFactor The zoom factor of the web view: each pixel of the page covers this many points of the window.
	 * @returns The same point in pixels of the page, measured from the top edge of the page.
	 */
	private static toPagePoint(position: DropPosition, zoomFactor: number): { x: number; y: number } {
		return {
			x: position.x / zoomFactor,
			y: (position.y - DropTarget.topInsetPoints) / zoomFactor,
		};
	}
}
