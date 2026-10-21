import { reactive } from 'vue';

/** The state of the composition bar that belongs to one pane. */
export type CompositionBarState = {
	/** True while the composition bar is open in its pane. Only an open composition bar receives a drop of images. */
	isOpen: boolean;
	/** Absolute paths of the image files, in the order in which they were added. */
	paths: string[];
	/** The text that the developer typed, sent after the images. */
	text: string;
	/** Small picture of each image file as a `data:` address, by path.
	 * An empty text means the picture could not be made.
	 */
	thumbnails: Record<string, string>;
	/** Large picture of each image file that the big view has shown, as a `data:` address, by path. */
	previews: Record<string, string>;
	/** The position, in `paths`, of the image that the big view shows, or null when the big view is closed. */
	viewerIndex: number | null;
};

/** The composition bar state of each pane, keyed by the identifier of the pane. */
export class CompositionBar {
	/** The composition bar states, keyed by the identifier of the pane. */
	static readonly byPane = reactive<Record<string, CompositionBarState>>({});

	/**
	 * Returns the composition bar state of a pane, creating a closed state when the pane has no state yet.
	 * @param paneId The identifier of the pane.
	 * @returns The composition bar state of the pane.
	 */
	static forPane(paneId: string): CompositionBarState {
		const existing = CompositionBar.byPane[paneId];
		if (existing !== undefined) {
			return existing;
		}
		const state: CompositionBarState = {
			isOpen: false,
			paths: [],
			text: '',
			thumbnails: {},
			previews: {},
			viewerIndex: null,
		};
		CompositionBar.byPane[paneId] = state;
		return CompositionBar.byPane[paneId];
	}

	/**
	 * Removes the composition bar state of a pane that no longer exists.
	 * @param paneId The identifier of the pane.
	 */
	static removePane(paneId: string): void {
		delete CompositionBar.byPane[paneId];
	}
}

/** The composition bar state of every pane, keyed by the identifier of the pane. */
export const compositionBarsByPane = CompositionBar.byPane;
