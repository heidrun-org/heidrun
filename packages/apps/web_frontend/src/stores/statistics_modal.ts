import { reactive } from "vue";

/** State of the Statistics window: not saved, the window starts closed. */
export const statisticsModal = reactive({
  open: false,
});

/** Opens the Statistics window. The window reads the user activity records again each time that it opens. */
export function openStatisticsModal(): void {
  statisticsModal.open = true;
}

/** Closes the Statistics window. */
export function closeStatisticsModal(): void {
  statisticsModal.open = false;
}
