import { reactive } from "vue";

/** The folder selector modal dialog, opened to choose the folder of a new workspace. */
export const folderSelector = reactive({
  open: false,
  resolve: null as ((path: string | null) => void) | null,
});

/**
 * Opens the folder selector modal dialog and resolves to the absolute path of the chosen folder,
 * or to null when the user cancels.
 */
export function askFolder(): Promise<string | null> {
  // Only one dialog at a time: a second request cancels the first one.
  if (folderSelector.open) {
    folderSelector.resolve?.(null);
  }
  return new Promise((resolve) => {
    Object.assign(folderSelector, { open: true, resolve });
  });
}

/** Closes the folder selector modal dialog and gives the chosen folder (or null) to the caller of `askFolder`. */
export function answerFolder(path: string | null): void {
  const resolve = folderSelector.resolve;
  folderSelector.open = false;
  folderSelector.resolve = null;
  resolve?.(path);
}
