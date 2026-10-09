<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "./Icon.vue";
import { settings } from "../stores/settings";
import { THEME_OPTIONS, resolvedTheme } from "../stores/theme";
import { t } from "../i18n/index";

const open = ref(false);
const root = ref<HTMLElement>();

const buttonIcon = computed(() => (resolvedTheme.value === "dark" ? "moon-stars" : "sun"));

function choose(id: (typeof THEME_OPTIONS)[number]["id"]) {
  settings.theme = id;
  open.value = false;
}

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) {
    open.value = false;
  }
}
onMounted(() => document.addEventListener("mousedown", onDocClick));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocClick));
</script>

<template>
  <div ref="root" class="wrap">
    <button class="icon-btn" :class="{ on: open }" :aria-label="t('themeMenu.buttonLabel')" :title="t('themeMenu.buttonTitle')" @click="open = !open">
      <Icon :name="buttonIcon" />
    </button>
    <div v-if="open" class="menu" role="menu" :aria-label="t('themeMenu.menuLabel')">
      <button
        v-for="o in THEME_OPTIONS"
        :key="o.id"
        class="item"
        role="menuitemradio"
        :title="t('themeMenu.useTheme', { theme: t(o.labelKey) })"
        :aria-checked="settings.theme === o.id"
        @click="choose(o.id)"
      >
        <Icon :name="o.icon" />
        <span class="label">{{ t(o.labelKey) }}</span>
        <Icon v-if="settings.theme === o.id" name="check2" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.wrap { position: relative; }
.icon-btn {
  width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line-strong); background: transparent;
  color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.icon-btn:hover { background: var(--hover); color: var(--text); }
.icon-btn.on { color: var(--text-2); background: var(--field); }
.menu {
  position: absolute; right: 0; top: 38px; min-width: 170px; z-index: 30; padding: 6px; border-radius: 12px;
  border: 1px solid var(--line-modal); background: var(--field); box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
  display: flex; flex-direction: column; gap: 2px;
}
.item {
  display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border: none; border-radius: 8px;
  background: transparent; color: var(--text); font-size: 13px; text-align: left;
}
.item:hover { background: var(--hover); }
.label { flex: 1; }
</style>
