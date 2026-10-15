///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Mobile types — the shapes of the answers of the mobile server
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The status of one coding agent, as the desktop application reports it. */
export type AgentStatus = 'blocked' | 'working' | 'done' | 'idle' | 'unknown';

/** One choice of the menu that blocks a coding agent. */
export type MenuOption = {
	/** The number that the coding agent shows for the choice. */
	n: number;
	/** The text of the choice. */
	label: string;
};

/** The menu that blocks a coding agent: a question, the command that the question is about, and the choices. */
export type AgentMenu = {
	/** The question of the menu, or null when the coding agent shows none. */
	question: string | null;
	/** The command or the file that the question is about, or null. */
	detail: string | null;
	/** The choices of the menu. */
	options: MenuOption[];
};

/** One pane that runs a coding agent. */
export type AgentView = {
	/** The identifier of the pane. */
	paneId: string;
	/** The name of the coding agent, for example Claude Code. */
	name: string;
	/** The kind of the coding agent. */
	kind: string;
	/** The label of the workspace that holds the pane. */
	workspace: string;
	/** The label of the tab that holds the pane. */
	tab: string;
	/** The status of the coding agent. */
	status: AgentStatus;
	/** The time of the last change of the status, in milliseconds since 1970, or null. */
	since: number | null;
	/** The question that the coding agent asked, or null. */
	question: string | null;
	/** The percent of the context window that the coding agent used, or null. */
	context: number | null;
	/** The menu that blocks the coding agent, or null. */
	menu: AgentMenu | null;
};

/** One workspace and the coding agents that run in its panes. */
export type WorkspaceView = {
	/** The identifier of the workspace. */
	id: string;
	/** The label of the workspace. */
	label: string;
	/** The coding agents of the workspace. */
	agents: AgentView[];
};

/** One usage limit of a coding agent provider. */
export type QuotaView = {
	/** The name of the limit, for example "5-hour limit". */
	name: string;
	/** The percent of the limit that is used. */
	percent: number;
};

/** The answer of the method `state`: everything that the first screens show. */
export type Snapshot = {
	/** The time of the Mac when it made the answer, in milliseconds since 1970. */
	now: number;
	/** The identifiers of the panes that wait for the developer. */
	attention: string[];
	/** The workspaces, with their coding agents. */
	workspaces: WorkspaceView[];
	/** The usage limits. */
	quotas: QuotaView[];
};

/** A command that the guards of Heidrun want the developer to check once more. */
export type ConfirmRequest = {
	/** The command, as the Mac shows it now. */
	command: string;
	/** Why the guards stopped the command. */
	why: string;
};

/** The answer of the methods `read`, `answer`, `prompt`, and `keys`. */
export type CallResult = {
	/** A text for the developer, when the call did not work. */
	error?: string;
	/** A command to check once more, when the guards stopped the call. */
	confirm?: ConfirmRequest;
	/** True when the call worked. */
	ok?: boolean;
	/** The end of the output of a pane, for the method `read`. */
	text?: string;
};

/** The screens that the bottom bar opens. */
export type TabName = 'needs_you' | 'panes' | 'macros' | 'launchers';

/** Every screen: the four screens of the bottom bar, and the screen of one pane. */
export type ScreenName = TabName | 'pane';
