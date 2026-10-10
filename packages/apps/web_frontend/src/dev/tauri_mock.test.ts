import { invoke } from '@tauri-apps/api/core';
import { clearMocks } from '@tauri-apps/api/mocks';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionSnapshot } from '../lib/types';
import { TauriMock } from './tauri_mock';
import { TauriMockFixture } from './tauri_mock_fixture';

const tauriWindow = window as unknown as { __TAURI_INTERNALS__?: unknown };

describe('TauriMock', () => {
	afterEach(() => {
		clearMocks();
		delete tauriWindow.__TAURI_INTERNALS__;
	});

	it('answers the Herdr request session.snapshot with the fake Herdr session', async () => {
		TauriMock.install();
		const result = await invoke<{ snapshot: SessionSnapshot }>('herdr_request', {
			method: 'session.snapshot',
			params: {},
		});
		expect(result.snapshot.workspaces.length).toBe(2);
		expect(result.snapshot.panes.length).toBe(4);
	});

	it('rejects a Tauri command that it does not list', async () => {
		TauriMock.install();
		await expect(invoke('pty_spawn')).rejects.toThrow('pty_spawn');
	});

	it('does nothing when a Tauri bridge already exists', () => {
		const existingBridge = {};
		tauriWindow.__TAURI_INTERNALS__ = existingBridge;
		TauriMock.install();
		expect(tauriWindow.__TAURI_INTERNALS__).toBe(existingBridge);
		expect(Object.keys(existingBridge).length).toBe(0);
	});
});

describe('TauriMockFixture', () => {
	it('links every pane to a tab and to a workspace that exist', () => {
		const snapshot = TauriMockFixture.buildSnapshot();
		const tabIdSet = new Set(snapshot.tabs.map((tabInfo) => tabInfo.tab_id));
		const workspaceIdSet = new Set(snapshot.workspaces.map((workspaceInfo) => workspaceInfo.workspace_id));
		for (const paneInfo of snapshot.panes) {
			expect(tabIdSet.has(paneInfo.tab_id)).toBe(true);
			expect(workspaceIdSet.has(paneInfo.workspace_id)).toBe(true);
		}
	});

	it('gives every tab a layout that lists only panes that exist', () => {
		const snapshot = TauriMockFixture.buildSnapshot();
		const paneIdSet = new Set(snapshot.panes.map((paneInfo) => paneInfo.pane_id));
		for (const tabInfo of snapshot.tabs) {
			const layout = snapshot.layouts.find((candidate) => candidate.tab_id === tabInfo.tab_id);
			expect(layout).not.toBeUndefined();
			for (const layoutPane of layout?.panes ?? []) {
				expect(paneIdSet.has(layoutPane.pane_id)).toBe(true);
			}
		}
	});

	it('shows every agent status once', () => {
		const snapshot = TauriMockFixture.buildSnapshot();
		const statusList = snapshot.panes.map((paneInfo) => paneInfo.agent_status).sort();
		expect(statusList).toEqual(['blocked', 'done', 'idle', 'working']);
	});
});
