import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Api from '../lib/api';
import { CompositionBar } from './composition_bar';
import { project, runLauncher } from './project';
import { settings } from './settings';
import { state } from './session';
import type { Launcher } from '../lib/project_config';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({
		setZoom: vi.fn(async () => {}),
	}),
}));
vi.mock('./guards', () => ({
	allowCommand: vi.fn(async () => true),
}));
vi.mock('../lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../lib/api')>()),
	newTab: vi.fn(async () => ({
		pane_id: 'w1:p1',
		tab_id: 'w1:t1',
	})),
	run: vi.fn(async () => undefined),
}));
vi.mock('./session', async (importOriginal) => ({
	...(await importOriginal<typeof import('./session')>()),
	refresh: vi.fn(async () => undefined),
	selectPane: vi.fn(),
	selectTab: vi.fn(),
	toast: vi.fn(),
}));

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	settings.isCompositionBarShownOnAgentStart = true;
	project.panes = {};
	project.busy = {};
	project.byWorkspace.w1 = {
		root: '/project',
		config_path: '',
		config: {
			version: 1,
			launchers: [],
		},
		detected: [],
	};
	CompositionBar.removePane('w1:p1');
});

afterEach(() => {
	vi.useRealTimers();
});

describe('launcher composition bar visibility (issue #726)', () => {
	it.each([
		['claude', true],
		['codex --model example', true],
		['agy -i hello', true],
		['pnpm dev', false],
		['echo claude', false],
	] as const)('initializes the composition bar for %s', async (command, isOpen) => {
		const launched = runLauncher('w1', {
			id: 'run',
			label: 'Run',
			command,
		});
		await vi.advanceTimersByTimeAsync(500);
		await launched;
		expect(Api.run).toHaveBeenCalledTimes(1);
		expect(CompositionBar.forPane('w1:p1').isOpen).toBe(isOpen);
	});

	it('keeps coding agent launcher panes hidden when the setting is off', async () => {
		settings.isCompositionBarShownOnAgentStart = false;
		const launched = runLauncher('w1', {
			id: 'run',
			label: 'Run',
			command: 'claude',
		});
		await vi.advanceTimersByTimeAsync(500);
		await launched;
		expect(CompositionBar.forPane('w1:p1').isOpen).toBe(false);
	});

	it('preserves a manually hidden composition bar when returning to or rerunning a launcher', async () => {
		const launcher: Launcher = {
			id: 'run',
			label: 'Run',
			command: 'claude',
		};
		project.panes['w1:run'] = 'w1:p1';
		state.snapshot = {
			version: 'test',
			protocol: 1,
			layouts: [],
			agents: [],
			workspaces: [],
			tabs: [],
			panes: [{
				pane_id: 'w1:p1',
				tab_id: 'w1:t1',
				terminal_id: 'terminal-1',
				workspace_id: 'w1',
				focused: false,
				agent_status: 'idle',
				revision: 0,
			}],
		};
		await runLauncher('w1', launcher);
		await runLauncher('w1', launcher, true);
		expect(Api.newTab).not.toHaveBeenCalled();
		expect(CompositionBar.forPane('w1:p1').isOpen).toBe(false);
	});
});
