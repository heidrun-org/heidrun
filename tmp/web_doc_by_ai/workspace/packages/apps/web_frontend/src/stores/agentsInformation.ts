import { reactive } from "vue";

/** State of the window Agents information: not saved, the window starts closed. */
export const agentsInformationModal = reactive({
  open: false,
});

/** Opens the window Agents information, which shows the account quotas and the activity of all agents. */
export function openAgentsInformationModal(): void {
  agentsInformationModal.open = true;
}

/** Closes the window Agents information. */
export function closeAgentsInformationModal(): void {
  agentsInformationModal.open = false;
}
