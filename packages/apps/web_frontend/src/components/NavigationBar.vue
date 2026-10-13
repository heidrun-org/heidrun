<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import type { SidebarSectionButton } from "../stores/sidebar_sections";
import { t } from "../i18n/index";

const props = defineProps<{
  /** The buttons of the navigation bar, one for each sidebar section of the sidebar. */
  sidebarSections: SidebarSectionButton[];
  /** The identifier of the selected sidebar section. */
  selectedId: string;
  /** The accessible name of the navigation bar. */
  label: string;
  /** The side of the sidebar: the collapse button shows an arrow toward that side. */
  side: "left" | "right";
}>();

const emit = defineEmits<{
  /** The person clicked the button of a sidebar section. */
  select: [id: string];
  /** The person clicked the collapse button: the sidebar becomes the sidebar icon bar. */
  collapse: [];
}>();

/** The element of the list of the buttons of the sidebar sections. */
const navigationBar = ref<HTMLElement | null>(null);

/** The titles of all the sidebar sections do not fit: only the selected sidebar section shows its title. */
const isCompact = ref(false);

/**
 * Compares the width that the buttons need to show every title with the width of the navigation bar. A title is always
 * in the page, cut at its edge, so its `scrollWidth` gives its whole width in both states.
 */
function measure() {
  const element = navigationBar.value;
  if (element === null) {
    return;
  }
  const buttons = Array.from(element.querySelectorAll<HTMLElement>(":scope > button"));
  if (buttons.length === 0) {
    return;
  }
  const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
  let neededWidth = gap * (buttons.length - 1);
  for (const button of buttons) {
    const label = button.querySelector<HTMLElement>(".sidebar-section-label");
    neededWidth += button.offsetWidth + (label === null ? 0 : label.scrollWidth - label.clientWidth);
  }
  isCompact.value = neededWidth > element.clientWidth + 0.5;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (typeof ResizeObserver === "undefined" || navigationBar.value === null) {
    return;
  }
  resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(navigationBar.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

watch(
  () => [props.sidebarSections, props.selectedId],
  async () => {
    await nextTick();
    measure();
  },
  { deep: true },
);
</script>

<template>
  <div class="navigation-row">
    <div ref="navigationBar" class="navigation-bar" :class="{ compact: isCompact }" role="tablist" :aria-label="label">
      <button
        v-for="sidebarSection in sidebarSections"
        :key="sidebarSection.id"
        :title="isCompact && selectedId !== sidebarSection.id ? sidebarSection.label : t('navigationBar.showSidebarSection')"
        role="tab"
        :aria-selected="selectedId === sidebarSection.id"
        :class="{ on: selectedId === sidebarSection.id }"
        @click="emit('select', sidebarSection.id)"
      >
        <Icon :name="sidebarSection.icon" class="sidebar-section-icon" /><span class="sidebar-section-label">{{ sidebarSection.label }}</span><span v-if="sidebarSection.badge" class="badge" :class="{ live: sidebarSection.isLive, alert: sidebarSection.isAlert }">{{ sidebarSection.badge }}</span>
      </button>
    </div>
    <button
      class="collapse-button"
      :title="t('navigationBar.collapseSidebar')"
      :aria-label="t('navigationBar.collapseSidebar')"
      @click="emit('collapse')"
    >
      <Icon :name="side === 'left' ? 'chevron-bar-left' : 'chevron-bar-right'" />
    </button>
  </div>
</template>

<style scoped>
.navigation-row { display: flex; align-items: flex-end; gap: 2px; border-bottom: 1px solid var(--line-strong); flex-shrink: 0; }
.navigation-bar { flex: 1 1 auto; min-width: 0; display: flex; gap: 2px; }
.navigation-bar button {
  flex: 1 1 auto; min-width: 0; height: 40px; margin-bottom: -1px; padding: 4px 10px; border: 1px solid transparent; line-height: 1.2;
  border-radius: 6px 6px 0 0; background: transparent; color: var(--muted); font-size: var(--font-size); font-weight: 500;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.navigation-bar button:hover:not(.on) { border-color: var(--line) var(--line) transparent; color: var(--text-2); }
.navigation-bar button.on { background: var(--side); color: var(--text); border-color: var(--line-strong) var(--line-strong) var(--side); }
.sidebar-section-icon { flex-shrink: 0; }
.sidebar-section-label { min-width: 0; overflow: hidden; white-space: nowrap; }
.navigation-bar.compact button:not(.on) { flex: 0 0 auto; }
.navigation-bar.compact button:not(.on) .sidebar-section-label { max-width: 0; }
.collapse-button {
  flex-shrink: 0; width: 28px; height: 28px; margin-bottom: 6px; padding: 0; border: none; border-radius: 6px;
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center;
}
.collapse-button:hover { background: var(--line); color: var(--text); }
.badge {
  flex-shrink: 0; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--line-strong); color: var(--text-2);
  font-size: var(--font-size); display: inline-flex; align-items: center; justify-content: center;
}
.badge.live { background: var(--tint-working); color: var(--working); }
.badge.alert { background: var(--tint-err); color: var(--blocked); }
</style>
