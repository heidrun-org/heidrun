// The state of the window "Save this search" and of the window "Edit the saved search" of the Code hosting sidebar
// section: one window that shows one of the two.
// - issue #378
import { reactive } from "vue";

/** The window "Save this search" or "Edit the saved search": not saved, the window starts closed. */
export const savedSearchModal = reactive({
  /** The window is open. */
  open: false,
  /** "save" is the window "Save this search", and "edit" is the window "Edit the saved search". */
  mode: "save" as "save" | "edit",
  /** In the mode "save": the search that the window keeps under a name. */
  query: "",
  /** In the mode "edit": the name of the saved search that the window edits. */
  name: "",
});

/**
 * Opens the window "Save this search".
 * @param query - the search to keep under a name
 */
export function openSaveSearchModal(query: string): void {
  Object.assign(savedSearchModal, { open: true, mode: "save", query, name: "" });
}

/**
 * Opens the window "Edit the saved search".
 * @param name - the name of the saved search to edit
 */
export function openEditSavedSearchModal(name: string): void {
  Object.assign(savedSearchModal, { open: true, mode: "edit", query: "", name });
}

/** Closes the window "Save this search" or "Edit the saved search". */
export function closeSavedSearchModal(): void {
  savedSearchModal.open = false;
}
