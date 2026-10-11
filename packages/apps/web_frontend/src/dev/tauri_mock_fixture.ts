import type { AgentInfo, AgentStatus, PaneInfo, PaneLayoutSnapshot, SessionSnapshot } from '../lib/types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TauriMockFixture — the fake Herdr session that the browser shows when no Tauri bridge exists
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The values that describe one pane of the fake Herdr session. */
type FixturePaneOptions = {
	/** The identifier of the pane. */
	paneId: string;
	/** The identifier of the tab that holds the pane. */
	tabId: string;
	/** The identifier of the workspace that holds the tab. */
	workspaceId: string;
	/** True when the pane is the focused pane of its tab. */
	isFocused: boolean;
	/** The status of the agent in the pane. */
	agentStatus: AgentStatus;
	/** The name of the agent program, or null when the pane is a plain terminal. */
	agent: string | null;
	/** The label of the pane. */
	label: string;
	/** The working folder of the pane. */
	cwd: string;
};

/**
 * The fake Herdr session. It has two workspaces, three tabs, and four panes, with every agent status present.
 */
export class TauriMockFixture {
	/** Share of the width that the left pane of the first tab takes. The Herdr request `layout.set_split_ratio` changes it. */
	private static _firstTabRatio = 0.5;

	/**
	 * Sets the share that the first group of a split takes, like the Herdr request `layout.set_split_ratio`.
	 * The fake session has one split only: the one between the two panes of the first tab.
	 *
	 * @param path - The way from the root of the layout to the split. The root split has an empty way.
	 * @param ratio - The new share of the first group. Like Herdr, the fixture keeps it between 0.1 and 0.9.
	 */
	static setSplitRatio(path: boolean[], ratio: number): void {
		if (path.length > 0) {
			throw new Error('split_not_found: split path not found');
		}
		TauriMockFixture._firstTabRatio = Math.min(0.9, Math.max(0.1, ratio));
	}

	/**
	 * Builds the snapshot that the Herdr request `session.snapshot` returns.
	 *
	 * @returns A new snapshot object each call, so that the application can change it freely.
	 */
	static buildSnapshot(): SessionSnapshot {
		const heidrunFolder = '/Users/demo/webwork/heidrun';
		const websiteFolder = '/Users/demo/webwork/website';

		const panesList: AgentInfo[] = [
			TauriMockFixture._buildPane({
				paneId: 'pane_1',
				tabId: 'tab_1',
				workspaceId: 'workspace_1',
				isFocused: true,
				agentStatus: 'working',
				agent: 'claude',
				label: 'Migrate to Bootstrap',
				cwd: heidrunFolder,
			}),
			TauriMockFixture._buildPane({
				paneId: 'pane_2',
				tabId: 'tab_1',
				workspaceId: 'workspace_1',
				isFocused: false,
				agentStatus: 'blocked',
				agent: 'codex',
				label: 'Review the pull request',
				cwd: heidrunFolder,
			}),
			TauriMockFixture._buildPane({
				paneId: 'pane_3',
				tabId: 'tab_2',
				workspaceId: 'workspace_1',
				isFocused: true,
				agentStatus: 'idle',
				agent: null,
				label: 'Terminal',
				cwd: heidrunFolder,
			}),
			TauriMockFixture._buildPane({
				paneId: 'pane_4',
				tabId: 'tab_3',
				workspaceId: 'workspace_2',
				isFocused: true,
				agentStatus: 'done',
				agent: 'claude',
				label: 'Fix the footer',
				cwd: websiteFolder,
			}),
		];

		const leftWidth = Math.round(200 * TauriMockFixture._firstTabRatio);
		const layoutsList: PaneLayoutSnapshot[] = [
			{
				workspace_id: 'workspace_1',
				tab_id: 'tab_1',
				zoomed: false,
				area: {
					x: 0,
					y: 0,
					width: 200,
					height: 50,
				},
				focused_pane_id: 'pane_1',
				panes: [
					{
						pane_id: 'pane_1',
						focused: true,
						rect: {
							x: 0,
							y: 0,
							width: leftWidth,
							height: 50,
						},
					},
					{
						pane_id: 'pane_2',
						focused: false,
						rect: {
							x: leftWidth,
							y: 0,
							width: 200 - leftWidth,
							height: 50,
						},
					},
				],
				splits: [
					{
						id: 'split_0_root',
						direction: 'right',
						ratio: TauriMockFixture._firstTabRatio,
						rect: {
							x: 0,
							y: 0,
							width: 200,
							height: 50,
						},
					},
				],
			},
			TauriMockFixture._buildSinglePaneLayout('workspace_1', 'tab_2', 'pane_3'),
			TauriMockFixture._buildSinglePaneLayout('workspace_2', 'tab_3', 'pane_4'),
		];

		const snapshot: SessionSnapshot = {
			version: '0.0.0-mock',
			protocol: 1,
			focused_workspace_id: 'workspace_1',
			focused_tab_id: 'tab_1',
			focused_pane_id: 'pane_1',
			workspaces: [
				{
					workspace_id: 'workspace_1',
					number: 1,
					label: 'heidrun',
					focused: true,
					pane_count: 3,
					tab_count: 2,
					active_tab_id: 'tab_1',
					agent_status: 'blocked',
					worktree: {
						branch: 'dev_jerome',
						path: heidrunFolder,
					},
				},
				{
					workspace_id: 'workspace_2',
					number: 2,
					label: 'website',
					focused: false,
					pane_count: 1,
					tab_count: 1,
					active_tab_id: 'tab_3',
					agent_status: 'done',
				},
			],
			tabs: [
				{
					tab_id: 'tab_1',
					workspace_id: 'workspace_1',
					number: 1,
					label: 'agents',
					focused: true,
					pane_count: 2,
					agent_status: 'blocked',
				},
				{
					tab_id: 'tab_2',
					workspace_id: 'workspace_1',
					number: 2,
					label: 'terminal',
					focused: false,
					pane_count: 1,
					agent_status: 'idle',
				},
				{
					tab_id: 'tab_3',
					workspace_id: 'workspace_2',
					number: 1,
					label: 'main',
					focused: true,
					pane_count: 1,
					agent_status: 'done',
				},
			],
			panes: panesList,
			layouts: layoutsList,
			agents: panesList.filter((paneInfo) => paneInfo.agent !== null),
		};
		return snapshot;
	}

	/**
	 * Builds the text that the Herdr request `pane.read` returns.
	 *
	 * @param paneId - The identifier of the pane to read.
	 * @returns The last lines of the terminal of the pane.
	 */
	static readPaneText(paneId: string): string {
		const textLinesList = [
			`$ pnpm test  # pane ${paneId}`,
			'',
			' RUN  v2.1.9',
			' ✓ src/lib/format.test.ts (12)',
			' ✓ src/lib/diff.test.ts (8)',
			'',
			' Test Files  2 passed (2)',
			'      Tests  20 passed (20)',
		];
		return textLinesList.join('\n');
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Builds one pane, with the fields that the application reads.
	 *
	 * @param options - The values that describe the pane.
	 * @returns The pane, as the agent list of the snapshot holds it.
	 */
	private static _buildPane(options: FixturePaneOptions): AgentInfo {
		const paneInfo: PaneInfo = {
			pane_id: options.paneId,
			terminal_id: `terminal_${options.paneId}`,
			workspace_id: options.workspaceId,
			tab_id: options.tabId,
			focused: options.isFocused,
			agent_status: options.agentStatus,
			revision: 1,
			agent: options.agent,
			display_agent: options.agent,
			label: options.label,
			title: options.label,
			cwd: options.cwd,
			foreground_cwd: options.cwd,
			terminal_title: options.label,
			terminal_title_stripped: options.label,
		};
		const agentInfo: AgentInfo = {
			...paneInfo,
			name: options.label,
			state_change_seq: 1,
			interactive_ready: true,
		};
		return agentInfo;
	}

	/**
	 * Builds the layout of a tab that holds one pane.
	 *
	 * @param workspaceId - The identifier of the workspace that holds the tab.
	 * @param tabId - The identifier of the tab.
	 * @param paneId - The identifier of the only pane of the tab.
	 * @returns The layout of the tab.
	 */
	private static _buildSinglePaneLayout(workspaceId: string, tabId: string, paneId: string): PaneLayoutSnapshot {
		const layout: PaneLayoutSnapshot = {
			workspace_id: workspaceId,
			tab_id: tabId,
			zoomed: false,
			area: {
				x: 0,
				y: 0,
				width: 200,
				height: 50,
			},
			focused_pane_id: paneId,
			panes: [
				{
					pane_id: paneId,
					focused: true,
					rect: {
						x: 0,
						y: 0,
						width: 200,
						height: 50,
					},
				},
			],
		};
		return layout;
	}
}
