import { workspaces } from './session';
import { t } from '../i18n/index';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WorkspaceFolders — the fixed workspace folders supplied by the desktop application
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Reads the saved workspace folder without consulting any pane. */
export class WorkspaceFolders {
	/**
	 * Returns the fixed folder, or null while an existing workspace needs explicit recovery.
	 * @param workspaceId - The identifier of the workspace.
	 * @returns The saved absolute folder, or null.
	 */
	static get(workspaceId: string): string | null {
		return workspaces.value.find((workspace) => workspace.workspace_id === workspaceId)?.workspace_folder ?? null;
	}

	/**
	 * Requires a recovered folder before creating a terminal or a coding agent.
	 * @param workspaceId - The identifier of the workspace.
	 * @returns The fixed absolute folder.
	 */
	static require(workspaceId: string): string {
		const folder = WorkspaceFolders.get(workspaceId);
		if (folder === null) {
			throw new Error(t('workspaceFolderRecovery.required'));
		}
		return folder;
	}
}
