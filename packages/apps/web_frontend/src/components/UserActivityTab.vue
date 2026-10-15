<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import UserActivityHistogram from "./UserActivityHistogram.vue";
import { UserActivity, type UserActivityRecord } from "../lib/user_activity";
import { UserActivitySlotLengthText } from "../lib/user_activity_slot_length_text";
import {
  USER_ACTIVITY_RANGES,
  UserActivitySlots,
  type UserActivityRangeId,
  type UserActivitySlot,
  type UserActivitySlotLengthId,
} from "../lib/user_activity_slots";
import { UserActivityWorkspaces, type UserActivityWorkspaceChoice } from "../lib/user_activity_workspaces";
import { workspaceCwd } from "../stores/project";
import { workspaces } from "../stores/session";
import { activePeriodStartedAt, selectedWorkspaceFolder } from "../stores/user_activity";
import { t } from "../i18n/index";

// The tab "User activity" of the Statistics window: the histogram of the user activity time, and three choices. The
// time range is the last hour, the last day, or the last week. The slot length depends on the time range, and it goes back
// to the slot length that the time range starts with each time that the time range changes. The workspaces are all of them
// at first, and the developer can hide any workspace. The records are read once, for the longest time range, when the
// window opens. Each choice then cuts the same records again, so a choice never reads the data layer again.

/** The choices of the radio button group of the time range, from left to right. */
const RANGE_CHOICES = [
  { id: "hour", labelKey: "statisticsModal.rangeHour", titleKey: "statisticsModal.rangeHourTitle" },
  { id: "day", labelKey: "statisticsModal.rangeDay", titleKey: "statisticsModal.rangeDayTitle" },
  { id: "week", labelKey: "statisticsModal.rangeWeek", titleKey: "statisticsModal.rangeWeekTitle" },
] as const satisfies readonly { id: UserActivityRangeId; labelKey: string; titleKey: string }[];

/** The time range of the histogram. The tab starts with the last hour. */
const rangeId = ref<UserActivityRangeId>("hour");

/** The slot length of the histogram. The tab starts with the slot length that the last hour starts with. */
const slotLengthId = ref<UserActivitySlotLengthId>(USER_ACTIVITY_RANGES.hour.defaultSlotLengthId);

/** The slot lengths that the developer can choose in the time range, from the shortest to the longest. */
const slotLengthIds = computed(() => USER_ACTIVITY_RANGES[rangeId.value].slotLengthIds);

/** The records of the periods that ended, or `null` while they are read. */
const records = ref<UserActivityRecord[] | null>(null);

/** The time of the reading, in milliseconds. The last slot of the histogram holds this time. */
const readAt = ref(0);

/** The folder of the workspace that ran the active period at the time of the reading, or `null` when no period ran. */
const runningPeriodFolder = ref<string | null>(null);

/** The start of the active period that ran at the time of the reading, or `null` when no period ran. */
const runningPeriodStartedAt = ref<number | null>(null);

/** The workspaces that the developer can choose. */
const workspaceChoices = ref<UserActivityWorkspaceChoice[]>([]);

/** The folders of the workspaces that the histogram shows. All the workspaces at first. */
const chosenFolders = ref<string[]>([]);

const errorText = ref("");

/** True when the histogram shows every workspace. */
const isEveryWorkspaceChosen = computed(
  () => workspaceChoices.value.length > 0 && workspaceChoices.value.every((choice) => chosenFolders.value.includes(choice.folder)),
);

/** The slots of the histogram, or `null` while the records are read. */
const slots = computed<UserActivitySlot[] | null>(() => {
  if (records.value === null) {
    return null;
  }
  return UserActivitySlots.compute(
    UserActivityWorkspaces.filterRecords(records.value, chosenFolders.value),
    UserActivityWorkspaces.runningPeriodStartedAt(runningPeriodStartedAt.value, runningPeriodFolder.value, chosenFolders.value),
    readAt.value,
    rangeId.value,
    slotLengthId.value,
  );
});

watch(rangeId, (newRangeId) => {
  slotLengthId.value = USER_ACTIVITY_RANGES[newRangeId].defaultSlotLengthId;
});

/** Chooses every workspace when one is hidden, and no workspace when every one is shown. */
function toggleEveryWorkspace(): void {
  chosenFolders.value = isEveryWorkspaceChosen.value === true ? [] : workspaceChoices.value.map((choice) => choice.folder);
}

/** Reads the records of the longest time range through the data layer, and lists the workspaces that they hold. */
async function load(): Promise<void> {
  const now = Date.now();
  try {
    const loaded = await invoke<UserActivityRecord[]>("user_activity_records_in_range", {
      since: UserActivity.formatTime(UserActivitySlots.earliestSlotStartedAt(now)),
      until: UserActivity.formatTime(now),
    });
    runningPeriodStartedAt.value = activePeriodStartedAt.value;
    runningPeriodFolder.value = activePeriodStartedAt.value === null ? null : selectedWorkspaceFolder.value;
    const openWorkspaces = workspaces.value.map((workspace) => ({
      folder: workspaceCwd(workspace.workspace_id),
      label: workspace.label,
    }));
    workspaceChoices.value = UserActivityWorkspaces.choices(loaded, runningPeriodFolder.value, openWorkspaces);
    chosenFolders.value = workspaceChoices.value.map((choice) => choice.folder);
    readAt.value = now;
    records.value = loaded;
  } catch (error) {
    errorText.value = String(error);
  }
}

onMounted(load);
</script>

<template>
  <div class="d-flex flex-column" style="height: 100%">
    <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
      <div class="btn-group" role="group" :aria-label="t('statisticsModal.rangeLabel')">
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
      <div class="d-flex align-items-center gap-2">
        <span class="form-text">{{ t("statisticsModal.slotLabel") }}</span>
        <div class="btn-group" role="group" :aria-label="t('statisticsModal.slotLabel')">
          <label
            v-for="id in slotLengthIds"
            :key="id"
            class="btn-check btn-outline theme-secondary"
            :title="t('statisticsModal.slotTitle', { slotLength: UserActivitySlotLengthText.of(id) })"
          >
            <input
              :id="`statistics-slot-${id}`"
              v-model="slotLengthId"
              type="radio"
              name="statistics-slot"
              autocomplete="off"
              :value="id"
            />
            {{ UserActivitySlotLengthText.of(id) }}
          </label>
        </div>
      </div>
    </div>
    <div v-if="workspaceChoices.length > 0" class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <span class="form-text">{{ t("statisticsModal.workspacesLabel") }}</span>
      <div class="d-flex flex-wrap gap-2" role="group" :aria-label="t('statisticsModal.workspacesLabel')">
        <label class="btn-check btn-outline theme-secondary" :title="t('statisticsModal.workspacesAllTitle')">
          <input
            id="statistics-workspace-all"
            type="checkbox"
            autocomplete="off"
            :checked="isEveryWorkspaceChosen"
            @change="toggleEveryWorkspace"
          />
          {{ t("statisticsModal.workspacesAll") }}
        </label>
        <label
          v-for="(choice, index) in workspaceChoices"
          :key="choice.folder"
          class="btn-check btn-outline theme-secondary"
          :title="t('statisticsModal.workspaceTitle', { folder: choice.folder })"
        >
          <input
            :id="`statistics-workspace-${index}`"
            v-model="chosenFolders"
            type="checkbox"
            autocomplete="off"
            :value="choice.folder"
          />
          {{ choice.name }}
        </label>
      </div>
    </div>
    <div style="flex: 1 1 0; min-height: 240px">
      <div v-if="errorText !== ''" class="alert alert-danger" role="alert">{{ t("statisticsModal.loadError", { error: errorText }) }}</div>
      <span v-else-if="slots === null" class="form-text">{{ t("statisticsModal.loading") }}</span>
      <span v-else-if="workspaceChoices.length > 0 && chosenFolders.length === 0" class="form-text">{{ t("statisticsModal.workspacesNone") }}</span>
      <UserActivityHistogram v-else :slots="slots" :range-id="rangeId" :slot-length-id="slotLengthId" />
    </div>
  </div>
</template>
