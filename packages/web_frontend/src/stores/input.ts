import { dockState } from "./dock";
import { insertText, selectedPane, state, toast } from "./session";
import { t } from "../i18n/index";

/**
 * Writes `text` into the terminal of the pane that has the keyboard: the focused pane of the side column,
 * else the selected pane. Enter is not pressed, so the user can edit the text first.
 */
export async function insertIntoFocusedPane(text: string) {
  const paneId = dockState.focus ?? state.selectedPaneId ?? selectedPane.value?.pane_id ?? null;
  if (paneId === null) {
    toast(t("inputStore.noPane"));
    return;
  }
  await insertText(paneId, text, false);
}
