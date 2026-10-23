import { reactive } from 'vue';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ZenMode — owns the temporary Zen Mode state
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Owns the temporary Zen Mode display state and its per-tab focus. */
export class ZenMode {
	/** The current Zen Mode display state. It is never saved between application launches. */
	static readonly state = reactive({
		/** Whether Zen Mode is active in the current window. */
		isActive: false,
		/** The pane shown by Zen Mode. */
		paneId: null as string | null,
	});

	/** The last pane focused in each tab during this Zen Mode run. */
	private static readonly lastFocusedPaneByTab = new Map<string, string>();

	/**
	 * Enters Zen Mode for a pane, or leaves Zen Mode when it is already active.
	 * @param paneId The pane whose header button was pressed.
	 * @param tabId The tab that holds the pane.
	 * @returns Nothing.
	 */
	static toggle(paneId: string, tabId: string): void {
		if (ZenMode.state.isActive) {
			ZenMode.exit();
			return;
		}
		ZenMode.lastFocusedPaneByTab.clear();
		ZenMode.lastFocusedPaneByTab.set(tabId, paneId);
		ZenMode.state.paneId = paneId;
		ZenMode.state.isActive = true;
	}

	/**
	 * Leaves Zen Mode and forgets the focus remembered during this run.
	 * @returns Nothing.
	 */
	static exit(): void {
		ZenMode.state.isActive = false;
		ZenMode.state.paneId = null;
		ZenMode.lastFocusedPaneByTab.clear();
	}

	/**
	 * Leaves Zen Mode before the visible pane is closed.
	 * @param paneId The pane being closed.
	 * @returns Nothing.
	 */
	static exitForPane(paneId: string): void {
		if (ZenMode.state.isActive && ZenMode.state.paneId === paneId) {
			ZenMode.exit();
		}
	}

	/**
	 * Shows the last pane focused in a selected tab, or its selected pane when this run has no saved focus there.
	 * @param tabId The selected tab, or null when no tab is selected.
	 * @param selectedPaneId The pane selected by the normal tab and workspace state.
	 * @returns Nothing.
	 */
	static selectPaneForTab(tabId: string | null, selectedPaneId: string | null): void {
		if (ZenMode.state.isActive === false) {
			return;
		}
		if (tabId === null) {
			ZenMode.state.paneId = null;
			return;
		}
		ZenMode.state.paneId = ZenMode.lastFocusedPaneByTab.get(tabId) ?? selectedPaneId;
		if (ZenMode.state.paneId !== null) {
			ZenMode.lastFocusedPaneByTab.set(tabId, ZenMode.state.paneId);
		}
	}

	/**
	 * Records a focused pane while Zen Mode is active.
	 * @param paneId The pane that received focus.
	 * @param tabId The tab that holds the pane.
	 * @returns Nothing.
	 */
	static focusPane(paneId: string, tabId: string): void {
		if (ZenMode.state.isActive === false) {
			return;
		}
		ZenMode.lastFocusedPaneByTab.set(tabId, paneId);
		ZenMode.state.paneId = paneId;
	}

	/**
	 * Leaves Zen Mode when its visible pane is no longer in the session.
	 * @param paneIds The pane ids still in the session.
	 * @returns Nothing.
	 */
	static exitIfPaneIsMissing(paneIds: string[]): void {
		const existingPaneIds = new Set(paneIds);
		for (const [tabId, paneId] of ZenMode.lastFocusedPaneByTab) {
			if (existingPaneIds.has(paneId) === false) {
				ZenMode.lastFocusedPaneByTab.delete(tabId);
			}
		}
		if (
			ZenMode.state.isActive &&
			ZenMode.state.paneId !== null &&
			existingPaneIds.has(ZenMode.state.paneId) === false
		) {
			ZenMode.exit();
		}
	}
}
