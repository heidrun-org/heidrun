import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
	invoke: vi.fn(async (_command: string, _args?: unknown): Promise<unknown> => []),
	open: vi.fn(),
	refresh: vi.fn(async () => {}),
	selectWorkspace: vi.fn(),
	openFolderAsWorkspace: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: mocks.invoke,
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
	open: mocks.open,
}));
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
	writeText: vi.fn(async () => {}),
}));
vi.mock('../i18n/index', () => ({
	t: (key: string) => key,
}));
vi.mock('../stores/session', async () => {
	const { ref } = await import('vue');
	return {
		selectedWorkspace: ref(null),
		workspaces: ref([]),
		state: {
			selectedWorkspaceId: 'w1',
		},
		refresh: mocks.refresh,
		selectWorkspace: mocks.selectWorkspace,
		openFolderAsWorkspace: mocks.openFolderAsWorkspace,
	};
});

import type { Ref } from 'vue';
import { selectedWorkspace, workspaces } from '../stores/session';
import type { WorkspaceInfo } from '../lib/types';
import WorkspaceFolderRecovery from './WorkspaceFolderRecovery.vue';
import GitWorktreesModal from './GitWorktreesModal.vue';

const selected = selectedWorkspace as Ref<WorkspaceInfo | null>;
const workspaceList = workspaces as Ref<WorkspaceInfo[]>;

beforeEach(() => {
	vi.clearAllMocks();
	const workspace = {
		workspace_id: 'w1',
		label: 'Main checkout',
		workspace_folder: null,
	} as WorkspaceInfo;
	selected.value = workspace;
	workspaceList.value = [workspace];
	mocks.invoke.mockResolvedValue(undefined);
	mocks.open.mockResolvedValue(null);
});

describe('workspace folder selection (#724)', () => {
	it('shows recovery only for a workspace without a saved folder', async () => {
		const wrapper = mount(WorkspaceFolderRecovery);
		expect(wrapper.find('button').exists()).toBe(true);
		selected.value!.workspace_folder = '/main';
		await flushPromises();
		expect(wrapper.find('button').exists()).toBe(false);
		wrapper.unmount();
	});

	it('saves an explicit folder selection and refreshes the workspace snapshot', async () => {
		mocks.open.mockResolvedValue('/main');
		const wrapper = mount(WorkspaceFolderRecovery);
		await wrapper.get('button').trigger('click');
		await flushPromises();
		expect(mocks.invoke).toHaveBeenCalledWith('workspace_folder_recover', {
			workspaceId: 'w1',
			folder: '/main',
		});
		expect(mocks.refresh).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it('does not save a folder when the developer cancels the chooser', async () => {
		const wrapper = mount(WorkspaceFolderRecovery);
		await wrapper.get('button').trigger('click');
		await flushPromises();
		expect(mocks.invoke).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it('selects the existing workspace by its fixed folder without requiring worktree metadata', async () => {
		selected.value!.workspace_folder = '/main';
		mocks.invoke.mockResolvedValue([
			{
				folder: '/main',
				branch: 'dev_jerome',
				created_at: null,
				last_commit_at: null,
			},
		]);
		const wrapper = mount(GitWorktreesModal, {
			props: {
				root: '/main',
				visible: true,
			},
		});
		await flushPromises();
		await wrapper.get('.open-worktree').trigger('click');
		expect(mocks.selectWorkspace).toHaveBeenCalledWith('w1');
		expect(mocks.openFolderAsWorkspace).not.toHaveBeenCalled();
		wrapper.unmount();
	});
});
