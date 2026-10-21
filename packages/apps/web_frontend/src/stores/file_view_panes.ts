import * as api from '../lib/api';
import { FileViewLabel } from '../lib/file_view_label';
import { refresh, selectPane, selectedPane, toast } from './session';
import { WorkspaceFolders } from './workspace_folders';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FileViewPanes — opens a file in a file view pane
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command that runs under a file view pane. It prints a line for the person who looks at the terminal in Herdr, then
 * waits for about three years, so that nobody types a command into the terminal that the file view hides.
 */
const WAIT_COMMAND = "echo 'Below the file view of Heidrun'; sleep 99999999";

/** Opens a file in a file view pane: a pane that shows the file, read only, over a terminal that only waits. */
export class FileViewPanes {
	/**
	 * Shows a file in a file view pane. When the selected pane is a terminal, a new pane opens to its right and the terminal
	 * stays as it was. When the selected pane is a file view pane, the file replaces the file of that pane.
	 * @param absolutePath The absolute path of the file to show.
	 * @returns True when a file view pane shows the file, false when there is no selected pane or when Herdr failed.
	 */
	static async open(absolutePath: string): Promise<boolean> {
		const pane = selectedPane.value;
		if (pane === null) {
			return false;
		}
		const label = FileViewLabel.format(absolutePath);
		try {
			if (FileViewLabel.parse(pane.label) !== null) {
				await api.renamePane(pane.pane_id, label);
				await refresh();
				return true;
			}
			const folder = WorkspaceFolders.require(pane.workspace_id);
			const newPane = await api.split(pane.pane_id, 'right', folder);
			await api.renamePane(newPane.pane_id, label);
			await api.run(newPane.pane_id, WAIT_COMMAND);
			await refresh();
			selectPane(newPane);
			return true;
		} catch (error) {
			toast(String(error), 'error');
			return false;
		}
	}
}
