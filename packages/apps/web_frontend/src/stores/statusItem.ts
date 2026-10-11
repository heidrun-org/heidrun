import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { t } from "../i18n/index";
import { quotaRingWindow } from "../lib/format";
import { buildStatusItemPayload } from "../lib/status_item";
import { allPanes, paneFullName, quotas, selectPane, state } from "./session";
import { settings } from "./settings";

/** Name of the event that the Rust side sends when the user chooses an agent in the menu of the status item. */
const SELECT_PANE_EVENT = "status-item-select-pane";

/** Time between two readings of the clock, in milliseconds: the status item turns red within this time. */
const CLOCK_INTERVAL_MS = 15_000;

/** The current time in milliseconds, updated every `CLOCK_INTERVAL_MS`. */
const now = ref(Date.now());

/** The quota of the account that the fourth slot of the status item shows: Claude first, then any other account. */
const shownQuota = computed(() => {
  const owned = quotas.value.filter((quota) => settings.ownedAgents.includes(quota.provider));
  const quota = owned.find((candidate) => candidate.provider === "claude") ?? owned[0];
  const ringWindow = quota === undefined ? undefined : quotaRingWindow(quota.windows);
  if (quota === undefined || ringWindow === undefined) {
    return null;
  }
  const percent = Math.round(ringWindow.percent);
  return { percent: ringWindow.percent, text: t("statusItem.quota", { name: quota.label.split(" · ")[0], percent }) };
});

/** The data of the status item, as text: the status item is updated only when this text changes. */
const payloadJson = computed(() =>
  JSON.stringify(
    buildStatusItemPayload({
      agents: allPanes.value
        .filter((pane) => pane.agent)
        .map((pane) => ({
          paneId: pane.pane_id,
          name: paneFullName(pane),
          status: pane.agent_status,
          since: state.since[pane.pane_id] ?? null,
        })),
      now: now.value,
      blockedLimitMs: settings.notifBlockedMin * 60_000,
      quota: shownQuota.value,
      titles: {
        blocked: t("statusBar.blockedTitle"),
        done: t("statusBar.doneTitle"),
        working: t("statusBar.workingTitle"),
      },
      openLabel: t("statusItem.open"),
      emptyLabel: t("statusBar.noAgent"),
    }),
  ),
);

let started = false;

/**
 * Starts the status item in the macOS menu bar: sends the agents and the quota to the Rust side each time they change,
 * and selects the agent that the user chooses in the menu. Outside of the Tauri window, nothing happens.
 */
export function startStatusItem() {
  if (started) {
    return;
  }
  started = true;
  window.setInterval(() => {
    now.value = Date.now();
  }, CLOCK_INTERVAL_MS);
  watch(
    () => settings.showStatusItem,
    (isVisible) => {
      invoke("status_item_set_visible", { isVisible }).catch(() => {});
    },
    { immediate: true },
  );
  watch(
    payloadJson,
    (json) => {
      invoke("status_item_update", { payload: JSON.parse(json) }).catch(() => {});
    },
    { immediate: true },
  );
  listen<string>(SELECT_PANE_EVENT, (event) => {
    const pane = allPanes.value.find((candidate) => candidate.pane_id === event.payload);
    if (pane !== undefined) {
      selectPane(pane);
    }
  }).catch(() => {});
}
