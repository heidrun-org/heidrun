import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type { SessionSnapshot } from './lib/types';

const { dropHandlers } = vi.hoisted(() => ({
	dropHandlers: [] as Array<(event: unknown) => void>,
}));

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async () => () => {}),
}));
vi.mock('./components/TerminalView.vue', () => ({
	default: {
		render: () => null,
	},
}));
vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => ({
		innerSize: vi.fn(async () => ({ height: 2 * (window.innerHeight + 30) })),
		scaleFactor: vi.fn(async () => 2),
	}),
}));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({
		onDragDropEvent: vi.fn(async (handler: (event: unknown) => void) => {
			dropHandlers.push(handler);
			return () => {};
		}),
	}),
}));
vi.mock('./stores/session', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/session')>()),
	start: vi.fn(),
}));
vi.mock('./stores/project', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/project')>()),
	startProjects: vi.fn(),
}));
vi.mock('./stores/git', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/git')>()),
	startGit: vi.fn(),
}));
vi.mock('./stores/alerts', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/alerts')>()),
	startAlerts: vi.fn(),
}));
vi.mock('./stores/statusItem', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/statusItem')>()),
	startStatusItem: vi.fn(),
}));
vi.mock('./stores/history', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/history')>()),
	loadHistory: vi.fn(),
}));
vi.mock('./stores/mobile', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/mobile')>()),
	startMobile: vi.fn(),
}));
vi.mock('./stores/claude', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/claude')>()),
	loadClaudeLink: vi.fn(),
	startRemoteWatch: vi.fn(),
}));

import { COMPOSITION_BAR_PANE_ID_ATTRIBUTE, DropTarget } from './lib/drop_target';
import { CompositionBar } from './stores/composition_bar';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ImageDropTest — exercises a drop of files through the application's drop listener
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The pane that has the focus in every test. */
const FOCUSED_PANE_ID = 'pane-c';

/** The original `elementFromPoint` of the document, which jsdom leaves undefined. */
const originalElementFromPoint = document.elementFromPoint;

/** Mounts the application with three panes in one tab, and drops files on chosen points. */
class ImageDropTest {
	/** The application mounted by the current test. */
	static wrapper: ReturnType<typeof shallowMount> | null = null;

	/** The element under each horizontal point: the test says which pane the pointer is over. */
	static elementByX = new Map<number, Element>();

	/** The points of the page that the application looked up, in order. */
	static lookedUpPoints: Array<{ x: number; y: number }> = [];

	/**
	 * Mounts the application with the panes `pane-a`, `pane-b`, and `pane-c`, where `pane-c` has the focus.
	 * @returns The real session store.
	 */
	static async mount() {
		window.matchMedia = vi.fn(() => ({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})) as unknown as typeof window.matchMedia;
		const session = await import('./stores/session');
		const { default: App } = await import('./App.vue');
		session.state.snapshot = {
			workspaces: [{ workspace_id: 'w1' }],
			tabs: [{ tab_id: 't1', workspace_id: 'w1', label: 't1' }],
			panes: ['pane-a', 'pane-b', 'pane-c'].map((paneId) => ({
				pane_id: paneId,
				tab_id: 't1',
				workspace_id: 'w1',
			})),
			agents: [],
			layouts: [],
		} as unknown as SessionSnapshot;
		session.state.selectedWorkspaceId = 'w1';
		session.state.selectedTabId = 't1';
		session.state.selectedPaneId = FOCUSED_PANE_ID;
		session.state.toast = '';
		ImageDropTest.elementByX.clear();
		ImageDropTest.lookedUpPoints = [];
		document.elementFromPoint = (x: number, y: number) => {
			ImageDropTest.lookedUpPoints.push({ x, y });
			return ImageDropTest.elementByX.get(x) ?? null;
		};
		ImageDropTest.wrapper = shallowMount(App);
		await flushPromises();
		return { session };
	}

	/**
	 * Opens the composition bar of a pane, and puts its element at a horizontal point, as the pane card renders it.
	 * @param paneId The identifier of the pane.
	 * @param x The horizontal point where the composition bar is.
	 */
	static openCompositionBarAt(paneId: string, x: number): void {
		CompositionBar.forPane(paneId).isOpen = true;
		const compositionBarElement = document.createElement('div');
		compositionBarElement.setAttribute(COMPOSITION_BAR_PANE_ID_ATTRIBUTE, paneId);
		document.body.appendChild(compositionBarElement);
		ImageDropTest.elementByX.set(x, compositionBarElement);
	}

	/**
	 * Puts a part of the window that is not a composition bar at a horizontal point.
	 * @param x The horizontal point.
	 */
	static putPaneBodyAt(x: number): void {
		const paneBodyElement = document.createElement('div');
		document.body.appendChild(paneBodyElement);
		ImageDropTest.elementByX.set(x, paneBodyElement);
	}

	/**
	 * Sends a drag event that has no file to drop to the application's actual drop listener.
	 * @param type The kind of drag event.
	 * @param x The horizontal point of the drag, for the kinds that have a point.
	 */
	static drag(type: 'enter' | 'over' | 'leave', x = 0): void {
		const handler = dropHandlers[dropHandlers.length - 1];
		handler({ payload: { type, paths: ['/shots/a.png'], position: { x, y: 10 } } });
	}

	/**
	 * Sends a drop of files to the application's actual drop listener.
	 * @param x The horizontal point of the drop.
	 * @param paths The paths of the dropped files.
	 */
	static drop(x: number, paths: string[]): void {
		const handler = dropHandlers[dropHandlers.length - 1];
		handler({ payload: { type: 'drop', paths, position: { x, y: 10 } } });
	}
}

beforeEach(() => {
	dropHandlers.length = 0;
	DropTarget.topInsetPoints = 0;
	DropTarget.clearHover();
	for (const paneId of ['pane-a', 'pane-b', 'pane-c']) {
		CompositionBar.removePane(paneId);
	}
});

afterEach(() => {
	ImageDropTest.wrapper?.unmount();
	ImageDropTest.wrapper = null;
	document.elementFromPoint = originalElementFromPoint;
	document.body.innerHTML = '';
});

describe('A drop of image files on the window', () => {
	it('goes to the composition bar under the pointer, and not to the focused pane', async () => {
		const { session } = await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-a', 100);
		ImageDropTest.openCompositionBarAt('pane-c', 300);
		ImageDropTest.drop(100, ['/shots/a.png']);
		expect(CompositionBar.forPane('pane-a').paths).toEqual(['/shots/a.png']);
		expect(CompositionBar.forPane('pane-b').paths).toEqual([]);
		expect(CompositionBar.forPane('pane-c').paths).toEqual([]);
		expect(session.state.selectedPaneId).toBe(FOCUSED_PANE_ID);
	});

	it('goes to the focused pane when the pointer is over the composition bar of the focused pane', async () => {
		await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-a', 100);
		ImageDropTest.openCompositionBarAt('pane-c', 300);
		ImageDropTest.drop(300, ['/shots/c.png']);
		expect(CompositionBar.forPane('pane-a').paths).toEqual([]);
		expect(CompositionBar.forPane('pane-c').paths).toEqual(['/shots/c.png']);
	});

	it('does nothing on a part of the window that is not a composition bar', async () => {
		const { session } = await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-c', 300);
		ImageDropTest.putPaneBodyAt(100);
		ImageDropTest.drop(100, ['/shots/a.png']);
		ImageDropTest.drop(500, ['/shots/b.png']);
		for (const paneId of ['pane-a', 'pane-b', 'pane-c']) {
			expect(CompositionBar.forPane(paneId).paths).toEqual([]);
		}
		expect(session.state.toast).toBe('');
	});

	it('does not open the composition bar of a pane that has none open, and does not give the images to the focused pane', async () => {
		await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-c', 300);
		ImageDropTest.putPaneBodyAt(100);
		ImageDropTest.drop(100, ['/shots/a.png']);
		expect(CompositionBar.forPane('pane-a').isOpen).toBe(false);
		expect(CompositionBar.forPane('pane-a').paths).toEqual([]);
		expect(CompositionBar.forPane('pane-c').paths).toEqual([]);
	});

	it('tells that a file is not an image when it is dropped on a composition bar', async () => {
		const { session } = await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-a', 100);
		ImageDropTest.drop(100, ['/notes.txt']);
		expect(session.state.toast).toBe('This file is not an image');
		expect(CompositionBar.forPane('pane-a').paths).toEqual([]);
	});

	it('adds the same file only once to a composition bar', async () => {
		await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-a', 100);
		ImageDropTest.drop(100, ['/shots/a.png']);
		ImageDropTest.drop(100, ['/shots/a.png']);
		expect(CompositionBar.forPane('pane-a').paths).toEqual(['/shots/a.png']);
	});
});

describe('The feedback while image files are dragged over the window', () => {
	it('marks the composition bar under the pointer, and no other composition bar', async () => {
		await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-a', 100);
		ImageDropTest.openCompositionBarAt('pane-c', 300);
		ImageDropTest.drag('enter', 100);
		expect(DropTarget.state.hoveredPaneId).toBe('pane-a');
		ImageDropTest.drag('over', 300);
		expect(DropTarget.state.hoveredPaneId).toBe('pane-c');
	});

	it('marks nothing over a part of the window that is not a composition bar', async () => {
		await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-c', 300);
		ImageDropTest.putPaneBodyAt(100);
		ImageDropTest.drag('over', 300);
		ImageDropTest.drag('over', 100);
		expect(DropTarget.state.hoveredPaneId).toBeNull();
	});

	it('removes the layer when the drag leaves the window', async () => {
		await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-a', 100);
		ImageDropTest.drag('over', 100);
		ImageDropTest.drag('leave');
		expect(DropTarget.state.hoveredPaneId).toBeNull();
	});

	it('removes the layer when the files are dropped', async () => {
		await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-a', 100);
		ImageDropTest.drag('over', 100);
		ImageDropTest.drop(100, ['/shots/a.png']);
		expect(DropTarget.state.hoveredPaneId).toBeNull();
		expect(CompositionBar.forPane('pane-a').paths).toEqual(['/shots/a.png']);
	});
});

describe('The title bar above the page', () => {
	it('is removed from the height of the drag, because the window counts the height from the title bar', async () => {
		await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-a', 100);
		ImageDropTest.drag('enter', 100);
		await vi.waitFor(() => expect(DropTarget.topInsetPoints).toBe(30));
		ImageDropTest.lookedUpPoints = [];
		ImageDropTest.drag('over', 100);
		expect(ImageDropTest.lookedUpPoints[ImageDropTest.lookedUpPoints.length - 1]).toEqual({ x: 100, y: 10 - 30 });
	});

	it('is removed from the height of the drop', async () => {
		await ImageDropTest.mount();
		ImageDropTest.openCompositionBarAt('pane-a', 100);
		DropTarget.topInsetPoints = 30;
		ImageDropTest.lookedUpPoints = [];
		ImageDropTest.drop(100, ['/shots/a.png']);
		expect(ImageDropTest.lookedUpPoints[ImageDropTest.lookedUpPoints.length - 1]).toEqual({ x: 100, y: 10 - 30 });
		expect(CompositionBar.forPane('pane-a').paths).toEqual(['/shots/a.png']);
	});
});
