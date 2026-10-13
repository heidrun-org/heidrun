import { reactive } from "vue";

/** State of the window "Three.js demo": not saved, the window starts closed. */
export const threeJsDemoModal = reactive({
  open: false,
});

/** Opens the window "Three.js demo", which draws a turning 3D shape with WebGL. */
export function openThreeJsDemoModal(): void {
  threeJsDemoModal.open = true;
}

/** Closes the window "Three.js demo". */
export function closeThreeJsDemoModal(): void {
  threeJsDemoModal.open = false;
}
