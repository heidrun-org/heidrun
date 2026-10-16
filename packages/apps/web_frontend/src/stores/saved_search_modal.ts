// The state of the window "Save this search" and of the window "Edit the saved search" of the Code hosting sidebar
// section: one window that shows one of the two, for one of the two lists.
// - issue #378
// - issue #607
import { reactive } from "vue";
import type { CodeHostingGroup } from "./code_hosting";

/** The window "Save this search" or "Edit the saved search": not saved, the window starts closed. */
export const savedSearchModal = reactive({
  /** The window is open. */
  open: false,
  /** "save" is the window "Save this search", and "edit" is the window "Edit the saved search". */
  mode: "save" as "save" | "edit",
  /** The list that the window works for. */
  group: "issues" as CodeHostingGroup,
  /** In the mode "save": the search that the window keeps under a name. */
  query: "",
  /** In the mode "edit": the name of the saved search that the window edits. */
  name: "",
});

/**
 * Opens the window "Save this search".
 * @param group - the list that the saved search is for
 * @param query - the search to keep under a name
 */
export function openSaveSearchModal(group: CodeHostingGroup, query: string): void {
  Object.assign(savedSearchModal, { open: true, mode: "save", group, query, name: "" });
}

/**
 * Opens the window "Edit the saved search".
 * @param group - the list of the saved search
 * @param name - the name of the saved search to edit
 */
export function openEditSavedSearchModal(group: CodeHostingGroup, name: string): void {
  Object.assign(savedSearchModal, { open: true, mode: "edit", group, query: "", name });
}

/** Closes the window "Save this search" or "Edit the saved search". */
export function closeSavedSearchModal(): void {
  savedSearchModal.open = false;
}
