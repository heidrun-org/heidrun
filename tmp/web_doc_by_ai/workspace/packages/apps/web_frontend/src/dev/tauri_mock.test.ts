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
		TauriMockFixture.setSplitRatio([], 0.5);
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

	it('moves the line between the two panes of the first tab with the Herdr request layout.set_split_ratio', async () => {
		TauriMock.install();
		await invoke('herdr_request', {
			method: 'layout.set_split_ratio',
			params: {
				tab_id: 'tab_1',
				path: [],
				ratio: 0.25,
			},
		});
		const result = await invoke<{ snapshot: SessionSnapshot }>('herdr_request', {
			method: 'session.snapshot',
			params: {},
		});
		const layout = result.snapshot.layouts.find((candidate) => candidate.tab_id === 'tab_1');
		expect(layout?.splits?.[0].ratio).toBe(0.25);
		expect(layout?.panes[0].rect.width).toBe(50);
		expect(layout?.panes[1].rect.x).toBe(50);
	});

	it('answers the Tauri command chats_list with the newest fake conversations of Claude and of Codex, up to the limit', async () => {
		TauriMock.install();
		type AgentChats = { chats: { id: string; title: string }[]; has_more: boolean };
		const result = await invoke<Record<'claude' | 'codex', AgentChats>>('chats_list', {
			folder: '/Users/demo/webwork/heidrun',
			limit: 5,
		});
		expect(result.claude.chats.length).toBe(5);
		expect(result.claude.has_more).toBe(true);
		expect(result.codex.chats.length).toBe(2);
		expect(result.codex.has_more).toBe(false);
		const everything = await invoke<Record<'claude' | 'codex', AgentChats>>('chats_list', {
			folder: '/Users/demo/webwork/heidrun',
			limit: 1000,
		});
		expect(everything.claude.chats.length).toBe(60);
		expect(everything.claude.has_more).toBe(false);
	});

	it('sorts the fake conversations of the Tauri command chats_list by the sort key and the order that it receives', async () => {
		TauriMock.install();
		type Answer = Record<'claude' | 'codex', { chats: { id: string }[]; has_more: boolean }>;
		const firstClaudeId = async (sortKey: string, order: string) => {
			const result = await invoke<Answer>('chats_list', { folder: '/x', limit: 3, sortKey, order });
			return result.claude.chats.map((chat) => chat.id);
		};
		expect(await firstClaudeId('last_updated', 'descending')).toEqual(['claude_1', 'claude_2', 'claude_3']);
		expect(await firstClaudeId('messages', 'descending')).toEqual(['claude_1', 'claude_2', 'claude_4']);
		expect(await firstClaudeId('messages', 'ascending')).toEqual(['claude_5', 'claude_6', 'claude_7']);
		expect(await firstClaudeId('issues', 'descending')).toEqual(['claude_3', 'claude_1', 'claude_2']);
		expect((await firstClaudeId('pull_requests', 'descending'))[0]).toBe('claude_4');
		expect((await firstClaudeId('files_written', 'descending'))[0]).toBe('claude_1');
		expect((await firstClaudeId('created_on', 'ascending'))[0]).toBe('claude_60');
		const withoutSort = await invoke<Answer>('chats_list', { folder: '/x', limit: 1 });
		expect(withoutSort.claude.chats[0].id).toBe('claude_1');
	});

	it('answers the cached forge command with the JSON of an issue and of a pull request, and fails for the issue 123', async () => {
		TauriMock.install();
		const issue = JSON.parse(
			await invoke<string>('forge_cli_cached', { cwd: '/x', tool: 'gh', args: ['issue', 'view', '250', '--json', 'title'] }),
		);
		expect(issue.title).toContain('Chats');
		expect(issue.headRefName).toBeUndefined();
		const pullRequest = JSON.parse(
			await invoke<string>('forge_cli_cached', { cwd: '/x', tool: 'gh', args: ['pr', 'view', '230', '--json', 'title'] }),
		);
		expect(pullRequest).toMatchObject({ state: 'MERGED', headRefName: expect.any(String), baseRefName: 'dev_jerome' });
		await expect(
			invoke('forge_cli_cached', { cwd: '/x', tool: 'gh', args: ['issue', 'view', '123', '--json', 'title'] }),
		).rejects.toThrow();
	});

	it('answers the cached forge command with the list of the open issues and the list of the open pull requests', async () => {
		TauriMock.install();
		const issues = JSON.parse(
			await invoke<string>('forge_cli_cached', { cwd: '/x', tool: 'gh', args: ['issue', 'list', '--state', 'open', '--json', 'number,title,url'] }),
		);
		expect(issues.map((issue: { number: number }) => issue.number)).toEqual([370, 366, 351]);
		const pullRequests = JSON.parse(
			await invoke<string>('forge_cli_cached', { cwd: '/x', tool: 'gh', args: ['pr', 'list', '--state', 'open', '--json', 'number,title,url'] }),
		);
		expect(pullRequests).toEqual([
			expect.objectContaining({ number: 369, url: expect.stringContaining('/pull/369') }),
			expect.objectContaining({ number: 365, url: expect.stringContaining('/pull/365') }),
		]);
	});

	it('keeps, in the fake list of the cached forge command, the items that match the words author:, label:, and no:label of --search', async () => {
		TauriMock.install();
		const numbersFor = async (tool: 'issue' | 'pr', search: string): Promise<number[]> => {
			const args = [tool, 'list', '--state', 'open', '--search', search, '--json', 'number'];
			const items = JSON.parse(await invoke<string>('forge_cli_cached', { cwd: '/x', tool: 'gh', args }));
			return items.map((item: { number: number }) => item.number);
		};
		expect(await numbersFor('issue', 'author:@me')).toEqual([370, 351]);
		expect(await numbersFor('issue', 'author:erictang')).toEqual([366]);
		expect(await numbersFor('issue', '-author:erictang')).toEqual([370, 351]);
		expect(await numbersFor('issue', 'label:bug')).toEqual([351]);
		expect(await numbersFor('issue', 'label:"Simple Work" -label:bug')).toEqual([370]);
		expect(await numbersFor('issue', 'no:label')).toEqual([366]);
		expect(await numbersFor('issue', 'mentions:@me')).toEqual([370, 366, 351]);
		expect(await numbersFor('pr', 'author:erictang')).toEqual([365]);
		expect(await numbersFor('pr', 'label:bug')).toEqual([]);
	});

	it('keeps a translation table of the clustered dynamic topics, and answers a fake coding agent that groups by the first four letters', async () => {
		TauriMock.install();
		expect(await invoke('topic_clusters_read')).toEqual({});
		await invoke('topic_clusters_write', { rows: { sidebar: 'sidebar' } });
		expect(await invoke('topic_clusters_read')).toEqual({ sidebar: 'sidebar' });
		await invoke('topic_clusters_write', { rows: {} });
		const prompt = 'Existing clusters: []\nNew labels: ["sidebars","sidebar","cache"]';
		const answer = await invoke<{ agent: string; text: string }>('coding_agent_ask', { prompt });
		expect(answer.agent).toBe('codex');
		expect(JSON.parse(answer.text)).toEqual([
			{ topic: 'sidebars', cluster: 'sidebar' },
			{ topic: 'sidebar', cluster: 'sidebar' },
			{ topic: 'cache', cluster: 'cache' },
		]);
	});

	it('answers the prompt of the method Language model with a fake coding agent that takes the long words of each title', async () => {
		TauriMock.install();
		const conversations = [
			{ conversation: 1, title: 'Fix the Sidebar cache bug', firstMessages: [] },
			{ conversation: 2, title: 'Do it', firstMessages: [] },
		];
		const prompt = `Existing topics: []\nConversations: ${JSON.stringify(conversations)}`;
		const answer = await invoke<{ agent: string; text: string }>('coding_agent_ask', { prompt });
		expect(answer.agent).toBe('codex');
		expect(JSON.parse(answer.text)).toEqual([
			{ conversation: 1, topics: ['sidebar', 'cache'] },
			{ conversation: 2, topics: ['general'] },
		]);
	});

	it('answers the root of the repository with the chats, and the commands that the files line of a chat calls', async () => {
		TauriMock.install();
		const result = await invoke<{ root: string }>('chats_list', { folder: '/Users/demo/webwork/heidrun', limit: 5 });
		expect(result.root).toBe('/Users/demo/webwork/heidrun');
		const refs = await invoke<{ remote: string }>('project_refs', { cwd: '/Users/demo/webwork/heidrun' });
		expect(refs.remote).toBe('git@github.com:heidrun-org/heidrun.git');
		const resolved = await invoke('files_resolve', {
			cwd: '/Users/demo/webwork/heidrun',
			path: '/Users/demo/webwork/heidrun/docs/a.md',
		});
		expect(resolved).toEqual({ root: '/Users/demo/webwork/heidrun', path: 'docs/a.md' });
		const existence = await invoke<{ path: string; on_disk: boolean; on_remote: boolean }[]>('chats_files_exist', {
			folder: '/Users/demo/webwork/heidrun',
			paths: ['docs/a.md', 'src/OldCard.vue', 'src/InformationCard.vue'],
		});
		expect(existence.map((item) => [item.on_disk, item.on_remote])).toEqual([
			[true, true],
			[false, false],
			[true, false],
		]);
		expect(await invoke('file_open_external', { root: '/Users/demo/webwork/heidrun', path: 'docs/a.md' })).toBeNull();
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
