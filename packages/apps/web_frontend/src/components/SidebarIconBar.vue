<script setup lang="ts">
import Icon from "./Icon.vue";
import type { SidebarSectionButton } from "../stores/sidebar_sections";
import { t } from "../i18n/index";

defineProps<{
  /** The buttons of the sidebar icon bar, one for each sidebar section of the sidebar. */
  sidebarSections: SidebarSectionButton[];
  /** The identifier of the sidebar section that the sidebar shows, or null when the sidebar is collapsed. */
  selectedId: string | null;
  /** The accessible name of the sidebar icon bar. */
  label: string;
  /** The side of the sidebar: the expand button shows an arrow toward the viewport. */
  side: "left" | "right";
  /** The sidebar is collapsed: the expand button sits above the icons. */
  isCollapsed: boolean;
}>();

const emit = defineEmits<{
  /** The person clicked the icon of a sidebar section. */
  select: [id: string];
  /** The person clicked the expand button: the sidebar expands to its selected sidebar section. */
  expand: [];
}>();
</script>

<template>
  <div class="sidebar-icon-bar">
    <button
      v-if="isCollapsed"
      class="expand-button"
      :title="t('sidebarIconBar.expandSidebar')"
      :aria-label="t('sidebarIconBar.expandSidebar')"
      @click="emit('expand')"
    >
      <Icon :name="side === 'left' ? 'chevron-bar-right' : 'chevron-bar-left'" />
    </button>
    <div class="icons" role="tablist" aria-orientation="vertical" :aria-label="label">
      <button
        v-for="sidebarSection in sidebarSections"
        :key="sidebarSection.id"
        :title="sidebarSection.label"
        :aria-label="sidebarSection.label"
        role="tab"
        :aria-selected="selectedId === sidebarSection.id"
        :class="{ on: selectedId === sidebarSection.id }"
        @click="emit('select', sidebarSection.id)"
      >
        <Icon :name="sidebarSection.icon" /><span v-if="sidebarSection.badge" class="badge" :class="{ live: sidebarSection.isLive, alert: sidebarSection.isAlert }">{{ sidebarSection.badge }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.sidebar-icon-bar {
  flex-shrink: 0; width: 46px; padding: 6px 0; background: var(--shell);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.icons { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.sidebar-icon-bar button {
  position: relative; width: 36px; height: 36px; padding: 0; border: none; border-radius: 6px; background: transparent;
  color: var(--muted); font-size: calc(var(--font-size) * 1.15); display: inline-flex; align-items: center; justify-content: center;
}
.sidebar-icon-bar button:hover:not(.on) { background: var(--line); color: var(--text-2); }
.icons button.on { background: var(--line-strong); color: var(--text); }
.badge {
  position: absolute; top: 0; right: 0; min-width: 14px; height: 14px; padding: 0 3px; border-radius: 7px;
  background: var(--line-strong); color: var(--text-2); font-size: calc(var(--font-size) * 0.65);
  display: inline-flex; align-items: center; justify-content: center;
}
.badge.live { background: var(--tint-working); color: var(--working); }
.badge.alert { background: var(--tint-err); color: var(--blocked); }
</style>
