<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import DialogCloseButton from "./DialogCloseButton.vue";
import PersonWorkTab from "./PersonWorkTab.vue";
import UserActivityTab from "./UserActivityTab.vue";
import { closeStatisticsModal } from "../stores/statistics_modal";
import { t } from "../i18n/index";

// The Statistics window, with one tab for each kind of statistic. The tab "User activity" holds the histogram of the
// user activity time, with the choices of its time range, of its slot length, and of its workspaces. The tab "Work of one
// person" holds the bar chart of the commits and of the pull requests of one person. The data comes from the data layer,
// and it is read again each time that the window opens, because the window is built again. The tab "Work of one person"
// reads its data when it is shown for the first time, and keeps it while the window stays open.

/** The tabs of the window, from left to right. */
const TABS = [
  { id: "user_activity", labelKey: "statisticsModal.userActivityTab" },
  { id: "person_work", labelKey: "statisticsModal.personWorkTab" },
] as const;

/** The tab that shows. */
const activeTab = ref<(typeof TABS)[number]["id"]>("user_activity");

/** True from the first time that the tab "Work of one person" is shown: the tab then stays built, with its data. */
const hasShownPersonWork = ref(false);

watch(activeTab, (tab) => {
  if (tab === "person_work") {
    hasShownPersonWork.value = true;
  }
});

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeStatisticsModal();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown, true);
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
            <UserActivityTab />
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
