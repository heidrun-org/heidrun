<script setup lang="ts">
import { t } from "../i18n/index";

defineProps<{
  /**
   * The buttons of the navigation bar, one for each sidebar section of the sidebar. A badge of 0 shows no number.
   * `isLive` gives the number the color of the working status. `isAlert` gives it the color of the blocked status.
   */
  sidebarSections: { id: string; label: string; badge: number; isLive?: boolean; isAlert?: boolean }[];
  /** The identifier of the selected sidebar section. */
  selectedId: string;
  /** The accessible name of the navigation bar. */
  label: string;
}>();

const emit = defineEmits<{
  /** The person clicked the button of a sidebar section. */
  select: [id: string];
}>();
</script>

<template>
  <div class="navigation-bar" role="tablist" :aria-label="label">
    <button
      v-for="sidebarSection in sidebarSections"
      :key="sidebarSection.id"
      :title="t('navigationBar.showSidebarSection')"
      role="tab"
      :aria-selected="selectedId === sidebarSection.id"
      :class="{ on: selectedId === sidebarSection.id }"
      @click="emit('select', sidebarSection.id)"
    >
      {{ sidebarSection.label }}<span v-if="sidebarSection.badge" class="badge" :class="{ live: sidebarSection.isLive, alert: sidebarSection.isAlert }">{{ sidebarSection.badge }}</span>
    </button>
  </div>
</template>

<style scoped>
.navigation-bar { display: flex; gap: 2px; border-bottom: 1px solid var(--line-strong); flex-shrink: 0; }
.navigation-bar button {
  flex: 1 1 auto; min-width: 0; min-height: 34px; margin-bottom: -1px; padding: 4px 10px; border: 1px solid transparent; line-height: 1.2;
  border-radius: 6px 6px 0 0; background: transparent; color: var(--muted); font-size: var(--font-size); font-weight: 500;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.navigation-bar button:hover:not(.on) { border-color: var(--line) var(--line) transparent; color: var(--text-2); }
.navigation-bar button.on { background: var(--side); color: var(--text); border-color: var(--line-strong) var(--line-strong) var(--side); }
.badge {
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--line-strong); color: var(--text-2);
  font-size: var(--font-size); display: inline-flex; align-items: center; justify-content: center;
}
.badge.live { background: var(--tint-working); color: var(--working); }
.badge.alert { background: var(--tint-err); color: var(--blocked); }
</style>
