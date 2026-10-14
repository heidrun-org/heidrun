import { reactive } from "vue";

/** State of the window Create a custom script: not saved, the window starts closed. */
export const newCustomScriptModal = reactive({
  open: false,
  /** The identifier of the custom script that the window edits. `null`: the window creates a new custom script. */
  editedId: null as string | null,
});

/** Opens the window Create a custom script, which adds a script to the section Custom Scripts. */
export function openNewCustomScriptModal(): void {
  newCustomScriptModal.editedId = null;
  newCustomScriptModal.open = true;
}

/** Opens the same window on an existing custom script, filled with its values. */
export function openEditCustomScriptModal(id: string): void {
  newCustomScriptModal.editedId = id;
  newCustomScriptModal.open = true;
}

/** Closes the window Create a custom script. */
export function closeNewCustomScriptModal(): void {
  newCustomScriptModal.open = false;
  newCustomScriptModal.editedId = null;
}
