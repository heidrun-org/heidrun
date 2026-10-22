import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { windowMock } = vi.hoisted(() => ({
	windowMock: {
		innerSize: vi.fn(),
		scaleFactor: vi.fn(),
	},
}));
vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => windowMock,
}));

import { COMPOSITION_BAR_PANE_ID_ATTRIBUTE, DropTarget } from './drop_target';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DropTargetTest — the composition bar under the point of a drop
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The function that answers which element is under a point: jsdom has no layout, so each test says the answer. */
const elementFromPointMock = vi.fn<(x: number, y: number) => Element | null>();

/** The original `elementFromPoint` of the document, which jsdom leaves undefined. */
const originalElementFromPoint = document.elementFromPoint;

/**
 * Adds an open composition bar to the document, as the pane card renders it.
 * @param paneId The identifier of the pane that owns the composition bar.
 * @returns The text input inside the composition bar, which is the deepest element under the pointer.
 */
function addCompositionBar(paneId: string): HTMLElement {
	const compositionBarElement = document.createElement('div');
	compositionBarElement.setAttribute(COMPOSITION_BAR_PANE_ID_ATTRIBUTE, paneId);
	const textInputElement = document.createElement('textarea');
	compositionBarElement.appendChild(textInputElement);
	document.body.appendChild(compositionBarElement);
	return textInputElement;
}

beforeEach(() => {
	elementFromPointMock.mockReset();
	document.elementFromPoint = elementFromPointMock;
	DropTarget.topInsetPoints = 0;
	DropTarget.clearHover();
});

afterEach(() => {
	document.elementFromPoint = originalElementFromPoint;
	document.body.innerHTML = '';
});

describe('DropTarget.paneIdAt', () => {
	it('returns the pane of the composition bar that holds the element under the point', () => {
		elementFromPointMock.mockReturnValue(addCompositionBar('pane-a'));
		expect(DropTarget.paneIdAt({ x: 10, y: 20 }, 1)).toBe('pane-a');
	});

	it('returns the pane of the composition bar under the point, and not the pane of another composition bar', () => {
		const paneAElement = addCompositionBar('pane-a');
		const paneCElement = addCompositionBar('pane-c');
		elementFromPointMock.mockImplementation((x) => (x < 100 ? paneAElement : paneCElement));
		expect(DropTarget.paneIdAt({ x: 50, y: 20 }, 1)).toBe('pane-a');
		expect(DropTarget.paneIdAt({ x: 150, y: 20 }, 1)).toBe('pane-c');
	});

	it('returns null when the element under the point is outside every composition bar', () => {
		const outsideElement = document.createElement('div');
		document.body.appendChild(outsideElement);
		addCompositionBar('pane-a');
		elementFromPointMock.mockReturnValue(outsideElement);
		expect(DropTarget.paneIdAt({ x: 10, y: 20 }, 1)).toBeNull();
	});

	it('returns null when no element is under the point', () => {
		elementFromPointMock.mockReturnValue(null);
		expect(DropTarget.paneIdAt({ x: 10, y: 20 }, 1)).toBeNull();
	});

	it('divides the point by the zoom factor, because the page shows each pixel as that many points', () => {
		elementFromPointMock.mockReturnValue(null);
		DropTarget.paneIdAt({ x: 300, y: 150 }, 1.5);
		expect(elementFromPointMock).toHaveBeenCalledWith(200, 100);
	});
});

describe('DropTarget with a title bar', () => {
	it('removes the height of the title bar from the point, because the page starts below the title bar', () => {
		elementFromPointMock.mockReturnValue(null);
		DropTarget.topInsetPoints = 30;
		DropTarget.paneIdAt({ x: 200, y: 130 }, 1);
		expect(elementFromPointMock).toHaveBeenCalledWith(200, 100);
	});

	it('removes the height of the title bar before it divides by the zoom factor', () => {
		elementFromPointMock.mockReturnValue(null);
		DropTarget.topInsetPoints = 30;
		DropTarget.paneIdAt({ x: 300, y: 180 }, 1.5);
		expect(elementFromPointMock).toHaveBeenCalledWith(200, 100);
	});

	it('measures the height of the title bar: the window is taller than the page', async () => {
		windowMock.innerSize.mockResolvedValue({ height: 2 * (window.innerHeight + 33) });
		windowMock.scaleFactor.mockResolvedValue(2);
		await DropTarget.measureTopInset(1);
		expect(DropTarget.topInsetPoints).toBe(33);
	});

	it('measures with the zoom factor, because the page shows each pixel as that many points', async () => {
		windowMock.innerSize.mockResolvedValue({ height: 2 * (window.innerHeight * 0.5 + 33) });
		windowMock.scaleFactor.mockResolvedValue(2);
		await DropTarget.measureTopInset(0.5);
		expect(DropTarget.topInsetPoints).toBe(33);
	});

	it('never measures a negative title bar', async () => {
		windowMock.innerSize.mockResolvedValue({ height: window.innerHeight - 50 });
		windowMock.scaleFactor.mockResolvedValue(1);
		await DropTarget.measureTopInset(1);
		expect(DropTarget.topInsetPoints).toBe(0);
	});

	it('keeps no title bar when the window cannot be measured', async () => {
		DropTarget.topInsetPoints = 30;
		windowMock.innerSize.mockRejectedValue(new Error('no window'));
		windowMock.scaleFactor.mockResolvedValue(2);
		await DropTarget.measureTopInset(1);
		expect(DropTarget.topInsetPoints).toBe(0);
	});
});

describe('DropTarget.hover', () => {
	it('records the composition bar under the drag, with the title bar and the zoom factor removed from the point', () => {
		elementFromPointMock.mockReturnValue(addCompositionBar('pane-a'));
		DropTarget.topInsetPoints = 30;
		DropTarget.hover({ x: 300, y: 180 }, 1.5);
		expect(DropTarget.state.hoveredPaneId).toBe('pane-a');
		expect(elementFromPointMock).toHaveBeenCalledWith(200, 100);
	});

	it('records no composition bar elsewhere', () => {
		elementFromPointMock.mockReturnValue(document.body);
		DropTarget.hover({ x: 40, y: 50 }, 1);
		expect(DropTarget.state.hoveredPaneId).toBeNull();
	});

	it('forgets the composition bar', () => {
		elementFromPointMock.mockReturnValue(addCompositionBar('pane-a'));
		DropTarget.hover({ x: 40, y: 50 }, 1);
		DropTarget.clearHover();
		expect(DropTarget.state.hoveredPaneId).toBeNull();
	});
});
