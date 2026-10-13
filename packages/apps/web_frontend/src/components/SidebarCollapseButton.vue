<script setup lang="ts">
import Icon from "./Icon.vue";
import { t } from "../i18n/index";

defineProps<{
  /** The side of the sidebar: the icon is an arrow toward that side. */
  side: "left" | "right";
}>();

const emit = defineEmits<{
  /** The person clicked the collapse button: the sidebar becomes the sidebar icon bar alone. */
  collapse: [];
}>();
</script>

<template>
  <button
    class="collapse-button"
    :title="t('sidebarIconBar.collapseSidebar')"
    :aria-label="t('sidebarIconBar.collapseSidebar')"
    @click="emit('collapse')"
  >
    <Icon :name="side === 'left' ? 'chevron-bar-left' : 'chevron-bar-right'" />
  </button>
</template>

<style scoped>
.collapse-button {
  flex-shrink: 0; width: 28px; height: 28px; padding: 0; border: none; border-radius: 6px;
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center;
}
.collapse-button:hover { background: var(--line); color: var(--text); }
</style>
