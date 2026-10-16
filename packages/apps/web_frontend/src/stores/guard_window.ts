// The state of the guard window: one window that shows a guard of the project to add, a guard of the project to edit, or a
// built-in guard to read. It opens over the Settings window.
// - issue #596
import { reactive } from "vue";

/** The guard window: not saved, the window starts closed. */
export const guardWindow = reactive({
  /** The window is open. */
  isOpen: false,
  /** "new" adds a guard of the project, "edit" changes one, and "view" shows a built-in guard that cannot be saved. */
  mode: "new" as "new" | "edit" | "view",
  /** In the mode "edit": the name of the guard of the project that the window edits, as it was when the window opened. */
  name: "",
  /** In the mode "view": the key of the built-in guard that the window shows, for example `guards.why.gitClean`. */
  builtInKey: "",
});

/** Opens the window "Add a guard". */
export function openNewGuardWindow(): void {
  Object.assign(guardWindow, { isOpen: true, mode: "new", name: "", builtInKey: "" });
}

/**
 * Opens the window "Edit the guard".
 * @param name - the name of the guard of the project to edit
 */
export function openEditGuardWindow(name: string): void {
  Object.assign(guardWindow, { isOpen: true, mode: "edit", name, builtInKey: "" });
}

/**
 * Opens the window that shows a built-in guard, with no button to save.
 * @param key - the key of the built-in guard
 */
export function openViewGuardWindow(key: string): void {
  Object.assign(guardWindow, { isOpen: true, mode: "view", name: "", builtInKey: key });
}

/** Closes the guard window. */
export function closeGuardWindow(): void {
  guardWindow.isOpen = false;
}
