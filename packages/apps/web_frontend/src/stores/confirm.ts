import { reactive } from "vue";

/** The confirmation modal dialog shown before a destructive action. */
export const confirmDialog = reactive({
  open: false,
  title: "",
  confirmLabel: "",
  resolve: null as ((ok: boolean) => void) | null,
});

/**
 * Opens the confirmation modal dialog and resolves to true when the user confirms.
 * The dialog has no timer: it stays open until the user confirms or cancels.
 */
export function askConfirm(title: string, confirmLabel: string): Promise<boolean> {
  // Only one dialog at a time: a second request cancels the first one.
  if (confirmDialog.open) {
    confirmDialog.resolve?.(false);
  }
  return new Promise((resolve) => {
    Object.assign(confirmDialog, { open: true, title, confirmLabel, resolve });
  });
}

/** Closes the confirmation modal dialog and gives the answer of the user to the caller of `askConfirm`. */
export function answerConfirm(ok: boolean): void {
  const resolve = confirmDialog.resolve;
  confirmDialog.open = false;
  confirmDialog.resolve = null;
  resolve?.(ok);
}
