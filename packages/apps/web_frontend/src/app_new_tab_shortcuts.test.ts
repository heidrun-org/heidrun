import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils';

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async () => () => {}),
}));
vi.mock('./components/TerminalView.vue', () => ({
	default: {
		render: () => null,
	},
}));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({
		onDragDropEvent: vi.fn(async () => () => {}),
	}),
}));
vi.mock('./stores/session', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/session')>()),
	start: vi.fn(),
	newTerminal: vi.fn(),
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
vi.mock('./stores/agents', async (importOriginal) => ({
	...(await importOriginal<typeof import('./stores/agents')>()),
	launchAgent: vi.fn(async () => 'ok'),
}));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	AppNewTabShortcutsTest — exercises tab creation through the window keyboard handler
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Helpers that mount and close the application for keyboard shortcut tests. */
class AppNewTabShortcutsTest {
	/** The application mounted by the current test. */
	static wrapper: VueWrapper | undefined;

	/**
	 * Mounts the application with a selected workspace and a preferred application.
	 * @param command - The preferred application for a new tab.
	 * @returns The tab and coding agent creation functions.
	 */
	static async mount(command: 'terminal' | 'claude' | 'codex' | 'agy') {
		window.matchMedia = vi.fn(() => ({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})) as unknown as typeof window.matchMedia;
		const session = await import('./stores/session');
		const { settings } = await import('./stores/settings');
		const { launchAgent } = await import('./stores/agents');
		const { default: App } = await import('./App.vue');
		settings.newTabCommand = command;
		session.state.snapshot = {
			version: 'test',
			protocol: 1,
			workspaces: [{
				workspace_id: 'w1',
				number: 1,
				label: 'project',
				focused: true,
				pane_count: 0,
				tab_count: 0,
				active_tab_id: '',
				agent_status: 'idle',
				workspace_folder: '/work/project',
			}],
			tabs: [],
			panes: [],
			agents: [],
			layouts: [],
		};
		session.state.selectedWorkspaceId = 'w1';
		AppNewTabShortcutsTest.wrapper = shallowMount(App);
		await flushPromises();
		vi.mocked(session.newTerminal).mockClear();
		vi.mocked(launchAgent).mockClear();
		return {
			newTerminal: session.newTerminal,
			launchAgent,
		};
	}

	/**
	 * Sends Command+T or Command+Shift+T to the application's window.
	 * @param isShift - Whether Shift is held.
	 * @returns The keyboard event, including whether the application consumed the event.
	 */
	static press(isShift: boolean): KeyboardEvent {
		const event = new KeyboardEvent('keydown', {
			key: isShift === true ? 'T' : 't',
			code: 'KeyT',
			metaKey: true,
			shiftKey: isShift,
			bubbles: true,
			cancelable: true,
		});
		window.dispatchEvent(event);
		return event;
	}
}

afterEach(() => {
	AppNewTabShortcutsTest.wrapper?.unmount();
	AppNewTabShortcutsTest.wrapper = undefined;
	vi.clearAllMocks();
});

describe('new tab shortcuts (issue #751)', () => {
	it.each(['terminal', 'claude', 'codex', 'agy'] as const)(
		'Command+T starts the preferred application %s directly',
		async (command) => {
			const { newTerminal, launchAgent } = await AppNewTabShortcutsTest.mount(command);
			expect(AppNewTabShortcutsTest.press(false).defaultPrevented).toBe(true);
			await flushPromises();
			if (command === 'terminal') {
				expect(newTerminal).toHaveBeenCalledTimes(1);
				expect(launchAgent).not.toHaveBeenCalled();
			} else {
				expect(newTerminal).not.toHaveBeenCalled();
				expect(launchAgent).toHaveBeenCalledTimes(1);
				expect(launchAgent).toHaveBeenCalledWith(expect.objectContaining({
					tool: command,
					agent: null,
					model: null,
					prompt: '',
				}));
			}
		},
	);

	it.each(['terminal', 'claude', 'codex', 'agy'] as const)(
		'Command+Shift+T starts a terminal directly when the preferred application is %s',
		async (command) => {
			const { newTerminal, launchAgent } = await AppNewTabShortcutsTest.mount(command);
			expect(AppNewTabShortcutsTest.press(true).defaultPrevented).toBe(true);
			await flushPromises();
			expect(newTerminal).toHaveBeenCalledTimes(1);
			expect(launchAgent).not.toHaveBeenCalled();
		},
	);
});

describe('command palette', () => {
	it('offers a terminal with Command+Shift+T and has no obsolete New agent entry', async () => {
		const { newTerminal, launchAgent } = await AppNewTabShortcutsTest.mount('codex');
		AppNewTabShortcutsTest.wrapper?.unmount();
		const { default: CommandPalette } = await import('./components/CommandPalette.vue');
		const { t } = await import('./i18n/index');
		const wrapper = shallowMount(CommandPalette);
		AppNewTabShortcutsTest.wrapper = wrapper;
		const rows = wrapper.findAll('button.row');
		const terminal = rows.find((row) => row.find('.grow').text() === t('commandPalette.newTerminal'));
		expect(terminal).toBeDefined();
		expect(terminal?.find('.hint').text()).toBe('⇧⌘T');
		expect(wrapper.text()).not.toContain('New agent');
		await terminal?.trigger('click');
		expect(newTerminal).toHaveBeenCalledTimes(1);
		expect(launchAgent).not.toHaveBeenCalled();
	});
});
