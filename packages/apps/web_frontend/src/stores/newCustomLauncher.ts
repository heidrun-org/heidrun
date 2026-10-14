import { reactive } from "vue";

/** State of the window Create a custom launcher: not saved, the window starts closed. */
export const newCustomLauncherModal = reactive({
  open: false,
  /** The identifier of the custom launcher that the window edits. `null`: the window creates a new custom launcher. */
  editedId: null as string | null,
});

/** Opens the window Create a custom launcher, which adds a launcher to the Launchers sidebar section. */
export function openNewCustomLauncherModal(): void {
  newCustomLauncherModal.editedId = null;
  newCustomLauncherModal.open = true;
}

/** Opens the same window on an existing custom launcher, filled with its values. */
export function openEditCustomLauncherModal(id: string): void {
  newCustomLauncherModal.editedId = id;
  newCustomLauncherModal.open = true;
}

/** Closes the window Create a custom launcher. */
export function closeNewCustomLauncherModal(): void {
  newCustomLauncherModal.open = false;
  newCustomLauncherModal.editedId = null;
}
