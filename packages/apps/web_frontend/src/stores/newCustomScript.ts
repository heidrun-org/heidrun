import { reactive } from "vue";

/** State of the window Create a custom script: not saved, the window starts closed. */
export const newCustomScriptModal = reactive({
  open: false,
});

/** Opens the window Create a custom script, which adds a script to the section Custom Scripts. */
export function openNewCustomScriptModal(): void {
  newCustomScriptModal.open = true;
}

/** Closes the window Create a custom script. */
export function closeNewCustomScriptModal(): void {
  newCustomScriptModal.open = false;
}
