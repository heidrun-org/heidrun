<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import DialogCloseButton from "./DialogCloseButton.vue";
import PersonWorkTab from "./PersonWorkTab.vue";
import UserActivityHistogram from "./UserActivityHistogram.vue";
import { UserActivity, type UserActivityRecord } from "../lib/user_activity";
import { UserActivitySlots, type UserActivityRangeId, type UserActivitySlot } from "../lib/user_activity_slots";
import { closeStatisticsModal } from "../stores/statistics_modal";
import { activePeriodStartedAt } from "../stores/user_activity";
import { t } from "../i18n/index";

// The Statistics window, with one tab for each kind of statistic. The tab "User activity" holds the histogram of the
// user activity time, and a radio button group that chooses its time range: the last hour, the last day, or the last
// week. The tab "Work of one person" holds the bar chart of the commits and of the pull requests of one person. The data
// comes from the data layer, and it is read again each time that the window opens, because the window is built again. The
// tab "Work of one person" reads its data when it is shown for the first time, and keeps it while the window stays open.

/** The tabs of the window, from left to right. */
const TABS = [
  { id: "user_activity", labelKey: "statisticsModal.userActivityTab" },
  { id: "person_work", labelKey: "statisticsModal.personWorkTab" },
] as const;

/** The choices of the radio button group of the tab "User activity", from left to right. */
const RANGE_CHOICES = [
  { id: "hour", labelKey: "statisticsModal.rangeHour", titleKey: "statisticsModal.rangeHourTitle" },
  { id: "day", labelKey: "statisticsModal.rangeDay", titleKey: "statisticsModal.rangeDayTitle" },
  { id: "week", labelKey: "statisticsModal.rangeWeek", titleKey: "statisticsModal.rangeWeekTitle" },
] as const satisfies readonly { id: UserActivityRangeId; labelKey: string; titleKey: string }[];

/** The tab that shows. */
const activeTab = ref<(typeof TABS)[number]["id"]>("user_activity");

/** True from the first time that the tab "Work of one person" is shown: the tab then stays built, with its data. */
const hasShownPersonWork = ref(false);

watch(activeTab, (tab) => {
  if (tab === "person_work") {
    hasShownPersonWork.value = true;
  }
});

/** The time range of the histogram. The window starts with the last hour. */
const rangeId = ref<UserActivityRangeId>("hour");

/** The slots of each time range, or `null` while the records are read. */
const slotsByRange = ref<Record<UserActivityRangeId, UserActivitySlot[]> | null>(null);

/** The slots of the histogram, or `null` while the records are read. */
const slots = computed(() => (slotsByRange.value === null ? null : slotsByRange.value[rangeId.value]));

const errorText = ref("");

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeStatisticsModal();
  }
}

/** Reads the records of the last week through the data layer, and cuts them into the slots of the three time ranges. */
async function load() {
  const now = Date.now();
  try {
    const records = await invoke<UserActivityRecord[]>("user_activity_records_in_range", {
      since: UserActivity.formatTime(UserActivitySlots.firstSlotStartedAt(now, "week")),
      until: UserActivity.formatTime(now),
    });
    const runningPeriodStartedAt = activePeriodStartedAt.value;
    slotsByRange.value = {
      hour: UserActivitySlots.compute(records, runningPeriodStartedAt, now, "hour"),
      day: UserActivitySlots.compute(records, runningPeriodStartedAt, now, "day"),
      week: UserActivitySlots.compute(records, runningPeriodStartedAt, now, "week"),
    };
  } catch (error) {
    errorText.value = String(error);
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown, true);
  load();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown, true);
});
</script>

<template>
  <div class="overlay" @mousedown.self="closeStatisticsModal">
    <dialog
      class="dialog dialog-xl dialog-instant dialog-nonmodal"
      style="--dialog-width: 94vw; height: 90vh"
      open
      aria-labelledby="statistics-title"
    >
      <div class="dialog-header">
        <div id="statistics-title" class="dialog-title me-auto" role="heading" aria-level="2">{{ t("statisticsModal.title") }}</div>
        <DialogCloseButton :title="t('statisticsModal.close')" :label="t('statisticsModal.close')" @click="closeStatisticsModal" />
      </div>
      <div class="dialog-body" style="flex: 1 1 0; min-height: 0; display: flex; flex-direction: column">
        <ul class="nav nav-tabs" role="tablist">
          <li v-for="tab in TABS" :key="tab.id" class="nav-item" role="presentation">
            <button
              :id="`statistics-tab-${tab.id}`"
              class="nav-link"
              :class="{ active: activeTab === tab.id }"
              type="button"
              role="tab"
              :aria-controls="`statistics-tab-${tab.id}-pane`"
              :aria-selected="activeTab === tab.id"
              @click="activeTab = tab.id"
            >{{ t(tab.labelKey) }}</button>
          </li>
        </ul>
        <div class="tab-content" style="flex: 1 1 0; min-height: 0; padding-top: var(--dialog-padding)">
          <div
            id="statistics-tab-user_activity-pane"
            class="tab-pane tab-pane-instant flex-column"
            :class="{ 'show active d-flex': activeTab === 'user_activity' }"
            style="height: 100%"
            role="tabpanel"
            aria-labelledby="statistics-tab-user_activity"
            tabindex="0"
          >
            <div class="btn-group align-self-start mb-3" role="group" :aria-label="t('statisticsModal.rangeLabel')">
              <label v-for="choice in RANGE_CHOICES" :key="choice.id" class="btn-check btn-outline theme-secondary" :title="t(choice.titleKey)">
                <input
                  :id="`statistics-range-${choice.id}`"
                  v-model="rangeId"
                  type="radio"
                  name="statistics-range"
                  autocomplete="off"
                  :value="choice.id"
                />
                {{ t(choice.labelKey) }}
              </label>
            </div>
            <div style="flex: 1 1 0; min-height: 240px">
              <div v-if="errorText !== ''" class="alert alert-danger" role="alert">{{ t("statisticsModal.loadError", { error: errorText }) }}</div>
              <UserActivityHistogram v-else-if="slots !== null" :slots="slots" :range-id="rangeId" />
              <span v-else class="form-text">{{ t("statisticsModal.loading") }}</span>
            </div>
          </div>
          <div
            id="statistics-tab-person_work-pane"
            class="tab-pane tab-pane-instant flex-column"
            :class="{ 'show active d-flex': activeTab === 'person_work' }"
            style="height: 100%"
            role="tabpanel"
            aria-labelledby="statistics-tab-person_work"
            tabindex="0"
          >
            <PersonWorkTab v-if="hasShownPersonWork" />
          </div>
        </div>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 59; background: rgba(0, 0, 0, 0.55); }
</style>
