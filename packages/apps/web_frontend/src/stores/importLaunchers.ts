import { reactive } from "vue";

/** State of the window Import launchers: not saved, the window starts closed. */
export const importLaunchersModal = reactive({
  open: false,
});

/** Opens the window Import launchers, which lists the commands that the project already has (package.json and similar files). */
export function openImportLaunchersModal(): void {
  importLaunchersModal.open = true;
}

/** Closes the window Import launchers. */
export function closeImportLaunchersModal(): void {
  importLaunchersModal.open = false;
}
