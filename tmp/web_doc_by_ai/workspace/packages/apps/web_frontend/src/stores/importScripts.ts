import { reactive } from "vue";

/** State of the window Import scripts: not saved, the window starts closed. */
export const importScriptsModal = reactive({
  open: false,
});

/** Opens the window Import scripts, which lists the scripts that the project already has (package.json and similar files). */
export function openImportScriptsModal(): void {
  importScriptsModal.open = true;
}

/** Closes the window Import scripts. */
export function closeImportScriptsModal(): void {
  importScriptsModal.open = false;
}
