import { reactive } from "vue";

/** The bottom input bar, shared so the palette and templates can fill it. */
export const input = reactive({
  text: "",
  /** Several recipients at once (broadcast); empty = the single target. */
  targets: [] as string[],
  multi: false,
  /** Bumped to ask the bar to focus its field. */
  focusTick: 0,
});

export function fillInput(text: string) {
  input.text = text;
  input.focusTick++;
}
