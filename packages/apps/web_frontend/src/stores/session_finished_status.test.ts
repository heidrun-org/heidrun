import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentStatus, SessionSnapshot } from '../lib/types';

const mocks = vi.hoisted(() => ({
	snapshot: vi.fn(),
	read: vi.fn(async () => ''),
	notifyPhone: vi.fn(async () => {}),
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(async () => null),
}));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async () => () => {}),
}));
vi.mock('@tauri-apps/api/path', () => ({
	homeDir: vi.fn(async () => '/home'),
}));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({
		setZoom: vi.fn(async () => {}),
	}),
}));
vi.mock('../lib/notify', () => ({
	notify: vi.fn(),
	notifyPhone: mocks.notifyPhone,
}));
vi.mock('../lib/api', () => ({
	snapshot: mocks.snapshot,
	read: mocks.read,
	watchPanes: vi.fn(async () => {}),
	codexUsage: vi.fn(async () => ({
		available: false,
		sessions: {},
	})),
}));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FinishedStatusTest — Finished acknowledgement, expiry, and newer activity
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Builds and reads controlled lifecycle snapshots through the session store. */
class FinishedStatusTest {
	/**
	 * Builds a workspace with a Finished pane and a second pane that determines aggregate priority.
	 * @param status - The first pane's current status.
	 * @param sequence - The first pane's lifecycle sequence.
	 * @param otherStatus - The second pane's status.
	 * @returns A complete snapshot with matching coding agent records.
	 */
	static snapshot(status: AgentStatus = 'done', sequence = 10, otherStatus: AgentStatus = 'idle'): SessionSnapshot {
		const priority: AgentStatus[] = ['blocked', 'working', 'done', 'idle', 'unknown'];
		const aggregate = priority.find((value) => value === status || value === otherStatus)!;
		const panes = [status, otherStatus].map((value, index) => ({
			pane_id: `p${index + 1}`,
			terminal_id: `terminal${index + 1}`,
			workspace_id: 'w1',
			tab_id: 't1',
			focused: false,
			agent: 'codex',
			agent_status: value,
			revision: 1,
		}));
		return {
			version: 'test',
			protocol: 22,
			workspaces: [{
				workspace_id: 'w1',
				number: 1,
				label: 'Test workspace',
				focused: false,
				pane_count: 2,
				tab_count: 1,
				active_tab_id: 't1',
				agent_status: aggregate,
			}],
			tabs: [{
				tab_id: 't1',
				workspace_id: 'w1',
				number: 1,
				label: 'Test tab',
				focused: false,
				pane_count: 2,
				agent_status: aggregate,
			}],
			panes,
			agents: panes.map((pane) => ({
				...pane,
				state_change_seq: sequence,
				completion_seq: pane.agent_status === 'done' ? sequence : undefined,
			})),
			layouts: [],
		};
	}

	/**
	 * Starts a fresh store with a Finished pane.
	 * @param otherStatus - The other pane's status.
	 * @returns The initialized session store and settings.
	 */
	static async start(otherStatus: AgentStatus = 'idle') {
		const session = await import('./session');
		const { settings } = await import('./settings');
		settings.finishedTtl = 15;
		mocks.snapshot.mockResolvedValue(FinishedStatusTest.snapshot('done', 10, otherStatus));
		await session.refresh();
		return {
			session,
			settings,
		};
	}

	/**
	 * Reads the next controlled snapshot.
	 * @param session - The session store under test.
	 * @param snapshot - The next Herdr snapshot.
	 * @returns Nothing after the snapshot has been applied.
	 */
	static async refresh(session: typeof import('./session'), snapshot: SessionSnapshot): Promise<void> {
		mocks.snapshot.mockResolvedValue(snapshot);
		await session.refresh();
	}
}

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-21T10:00:00Z'));
	localStorage.clear();
	mocks.snapshot.mockReset();
	mocks.notifyPhone.mockClear();
	mocks.read.mockResolvedValue('');
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('Finished to Idle', () => {
	it('hiding the card updates every displayed status and survives another Herdr snapshot', async () => {
		const { session } = await FinishedStatusTest.start();
		const raw = mocks.snapshot.mock.results[0].value;
		session.dismiss(session.allPanes.value[0]);
		expect(session.attention.value).toHaveLength(0);
		expect(session.allPanes.value[0].agent_status).toBe('idle');
		expect(session.tabs.value[0].agent_status).toBe('idle');
		expect(session.workspaces.value[0].agent_status).toBe('idle');
		await session.refresh();
		expect(session.allPanes.value[0].agent_status).toBe('idle');
		expect((await raw).panes[0].agent_status).toBe('done');
	});

	it('records and notifies a completed run once while acknowledging its result', async () => {
		const { session } = await FinishedStatusTest.start();
		const ended = vi.fn();
		session.onRunEnd(ended);
		await FinishedStatusTest.refresh(session, FinishedStatusTest.snapshot('working', 11));
		await FinishedStatusTest.refresh(session, FinishedStatusTest.snapshot('done', 12));
		await vi.advanceTimersByTimeAsync(2_000);
		expect(mocks.notifyPhone).toHaveBeenCalledTimes(1);
		session.dismiss(session.allPanes.value[0]);
		await session.refresh();
		expect(ended).toHaveBeenCalledTimes(1);
		expect(session.state.activity).toHaveLength(1);
		expect(session.state.activity[0].status).toBe('done');
	});

	it('selecting a Finished card acknowledges the same completion', async () => {
		const { session } = await FinishedStatusTest.start();
		session.selectPane(session.allPanes.value[0]);
		expect(session.allPanes.value[0].agent_status).toBe('idle');
		expect(session.attention.value).toHaveLength(0);
	});

	it('expires at the configured delay and keeps the completion Idle when the delay changes', async () => {
		const { session, settings } = await FinishedStatusTest.start();
		await vi.advanceTimersByTimeAsync(15 * 60_000);
		expect(session.allPanes.value[0].agent_status).toBe('idle');
		expect(session.tabs.value[0].agent_status).toBe('idle');
		expect(session.workspaces.value[0].agent_status).toBe('idle');
		settings.finishedTtl = 0;
		await session.refresh();
		expect(session.allPanes.value[0].agent_status).toBe('idle');
	});

	it('never expires with the delay set to never', async () => {
		const { session, settings } = await FinishedStatusTest.start();
		settings.finishedTtl = 0;
		await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
		expect(session.allPanes.value[0].agent_status).toBe('done');
		expect(session.attention.value).toHaveLength(1);
	});

	it.each(['working', 'blocked'] as const)('preserves a newer %s status after the old delay', async (status) => {
		const { session } = await FinishedStatusTest.start();
		await vi.advanceTimersByTimeAsync(14 * 60_000);
		await FinishedStatusTest.refresh(session, FinishedStatusTest.snapshot(status, 11));
		await vi.advanceTimersByTimeAsync(2 * 60_000);
		expect(session.allPanes.value[0].agent_status).toBe(status);
		expect(session.tabs.value[0].agent_status).toBe(status);
	});

	it.each(['working', 'blocked', 'done'] as const)('preserves another %s pane in aggregate statuses', async (status) => {
		const { session } = await FinishedStatusTest.start(status);
		session.dismiss(session.allPanes.value[0]);
		expect(session.allPanes.value[0].agent_status).toBe('idle');
		expect(session.tabs.value[0].agent_status).toBe(status);
		expect(session.workspaces.value[0].agent_status).toBe(status);
		session.state.selectedWorkspaceId = 'elsewhere';
		expect(session.otherWorkspaceStatus.value).toBe(status === 'working' ? null : status);
	});

	it('shows a new completion even when Working occurred between snapshots', async () => {
		const { session } = await FinishedStatusTest.start();
		const earlier = session.allPanes.value[0];
		session.dismiss(earlier);
		await vi.advanceTimersByTimeAsync(14 * 60_000);
		await FinishedStatusTest.refresh(session, FinishedStatusTest.snapshot('done', 12));
		session.dismiss(earlier);
		expect(session.allPanes.value[0].agent_status).toBe('done');
		await vi.advanceTimersByTimeAsync(2 * 60_000);
		expect(session.allPanes.value[0].agent_status).toBe('done');
		expect(session.attention.value).toHaveLength(1);
	});

	it('does not revive a hidden Finished card after its pending question read', async () => {
		mocks.read.mockResolvedValue('Would you like me to continue?');
		const { session } = await FinishedStatusTest.start();
		session.dismiss(session.allPanes.value[0]);
		await vi.advanceTimersByTimeAsync(2_000);
		expect(session.state.questions.p1).toBeUndefined();
		expect(session.attention.value).toHaveLength(0);
	});

	it('clears a previous question when a later completion arrives between snapshots', async () => {
		const { session } = await FinishedStatusTest.start();
		session.state.questions.p1 = {
			text: 'Previous question?',
			at: Date.now(),
		};
		await FinishedStatusTest.refresh(session, FinishedStatusTest.snapshot('done', 12));
		expect(session.state.questions.p1).toBeUndefined();
	});

	it('recalculates a workspace with another Working tab', async () => {
		const { session } = await FinishedStatusTest.start('working');
		const snapshot = FinishedStatusTest.snapshot('done', 10, 'working');
		snapshot.panes[1].tab_id = 't2';
		snapshot.agents[1].tab_id = 't2';
		snapshot.tabs[0].agent_status = 'done';
		snapshot.tabs.push({
			...snapshot.tabs[0],
			tab_id: 't2',
			agent_status: 'working',
		});
		await FinishedStatusTest.refresh(session, snapshot);
		session.dismiss(session.allPanes.value[0]);
		expect(session.state.snapshot?.tabs.map((tab) => tab.agent_status)).toEqual(['idle', 'working']);
		expect(session.workspaces.value[0].agent_status).toBe('working');
	});

	it('remembers acknowledgement after reloading the store', async () => {
		const { session } = await FinishedStatusTest.start();
		session.dismiss(session.allPanes.value[0]);
		vi.resetModules();
		const reloaded = await import('./session');
		await reloaded.refresh();
		expect(reloaded.allPanes.value[0].agent_status).toBe('idle');
	});

	it('does not acknowledge a different terminal with a reused pane identifier', async () => {
		const { session } = await FinishedStatusTest.start();
		session.dismiss(session.allPanes.value[0]);
		const snapshot = FinishedStatusTest.snapshot();
		snapshot.panes[0].terminal_id = 'new-terminal';
		snapshot.agents[0].terminal_id = 'new-terminal';
		await FinishedStatusTest.refresh(session, snapshot);
		expect(session.allPanes.value[0].agent_status).toBe('done');
	});
});
