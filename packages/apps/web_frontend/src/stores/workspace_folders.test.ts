import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionSnapshot } from '../lib/types';

const mocks = vi.hoisted(() => ({
	newTab: vi.fn(),
	split: vi.fn(),
	run: vi.fn(),
	snapshot: vi.fn(),
	allowCommand: vi.fn(async (_command: string, _cwd: string | null, _where: string) => true),
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(async () => []),
}));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async () => () => {}),
}));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({
		setZoom: vi.fn(async () => {}),
	}),
}));
vi.mock('../lib/api', () => ({
	newTab: mocks.newTab,
	split: mocks.split,
	run: mocks.run,
	snapshot: mocks.snapshot,
	watchPanes: vi.fn(async () => {}),
	codexUsage: vi.fn(async () => null),
}));
vi.mock('./guards', () => ({
	allowCommand: mocks.allowCommand,
}));

import { state, newTerminal, splitPane, runInNewPane, runInPane } from './session';
import { WorkspaceFolders } from './workspace_folders';
import { launchAgent } from './agents';

/** Representative workspaces whose panes have moved away from their original folders. */
class Fixture {
	/**
	 * Builds two workspaces and panes with different current working folders.
	 * @returns The populated session snapshot.
	 */
	static snapshot(): SessionSnapshot {
		return {
			workspaces: [
				{
					workspace_id: 'w1',
					workspace_folder: '/main',
					label: 'main',
					number: 1,
					active_tab_id: 't1',
				},
				{
					workspace_id: 'w2',
					workspace_folder: '/worktree',
					label: 'worktree',
					number: 2,
					active_tab_id: 't2',
				},
			],
			panes: [
				{
					pane_id: 'p1',
					workspace_id: 'w1',
					tab_id: 't1',
					cwd: '/worktree',
					foreground_cwd: '/unrelated',
				},
				{
					pane_id: 'p2',
					workspace_id: 'w2',
					tab_id: 't2',
					cwd: '/elsewhere',
				},
			],
			tabs: [
				{
					tab_id: 't1',
					workspace_id: 'w1',
				},
				{
					tab_id: 't2',
					workspace_id: 'w2',
				},
			],
			agents: [],
			layouts: [],
		} as unknown as SessionSnapshot;
	}
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	state.snapshot = Fixture.snapshot();
	state.selectedWorkspaceId = 'w1';
	state.selectedPaneId = 'p1';
	state.selectedTabId = 't1';
	mocks.snapshot.mockImplementation(async () => state.snapshot);
	mocks.newTab.mockResolvedValue(state.snapshot.panes[0]);
	mocks.split.mockResolvedValue(state.snapshot.panes[0]);
	mocks.run.mockResolvedValue(undefined);
	mocks.allowCommand.mockResolvedValue(true);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('fixed workspace folders (#724)', () => {
	it('keeps the folder after switching panes, changing folders, and closing every pane', () => {
		expect(WorkspaceFolders.get('w1')).toBe('/main');
		state.selectedPaneId = 'p2';
		state.snapshot!.panes = [];
		expect(WorkspaceFolders.get('w1')).toBe('/main');
		expect(WorkspaceFolders.get('w2')).toBe('/worktree');
	});

	it('starts terminals and splits in the workspace folder, including an explicitly targeted pane', async () => {
		await newTerminal();
		expect(mocks.newTab).toHaveBeenCalledWith('w1', '/main');
		await splitPane('down', 'p2');
		expect(mocks.split).toHaveBeenCalledWith('p2', 'down', '/worktree');
	});

	it('checks a command in a new pane against the folder where the command starts', async () => {
		const pending = runInNewPane('echo hello');
		await vi.advanceTimersByTimeAsync(500);
		await pending;
		expect(mocks.allowCommand).toHaveBeenCalledWith('echo hello', '/main', 'main');
		expect(mocks.split).toHaveBeenCalledWith('p1', 'right', '/main');
		await runInPane('p1', 'echo existing');
		expect(mocks.allowCommand.mock.calls[mocks.allowCommand.mock.calls.length - 1]?.[1]).toBe('/unrelated');
	});

	it.each([undefined, '01a03a5e-a361-7ab2-af03-62ea1a76ce4b'])(
		'starts new and resumed coding agents in the fixed folder despite a supplied pane folder', async (resumeId) => {
			const pending = launchAgent({
				workspaceId: 'w1',
				cwd: '/wrong',
				tool: 'claude',
				agent: null,
				model: null,
				label: 'Coding agent',
				prompt: '',
				resumeId,
			});
			await vi.advanceTimersByTimeAsync(500);
			expect(await pending).toBe('ok');
			expect(mocks.newTab).toHaveBeenCalledWith('w1', '/main', 'Coding agent');
			expect(mocks.allowCommand.mock.calls[0]?.[1]).toBe('/main');
		},
	);

	it('creates no terminal before explicit recovery and never adopts a pane folder', async () => {
		state.snapshot!.workspaces[0].workspace_folder = null;
		expect(WorkspaceFolders.get('w1')).toBeNull();
		await newTerminal();
		expect(mocks.newTab).not.toHaveBeenCalled();
		await runInPane('p1', 'echo still works');
		expect(mocks.run).toHaveBeenCalledWith('p1', 'echo still works');
	});
});
