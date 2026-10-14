<script setup lang="ts">
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

/** The two mouse modes, in the order of the buttons. */
const MOUSE_MODES = [
  { id: "select", labelKey: "fontMenu.mouseSelect", titleKey: "fontMenu.mouseSelectTitle" },
  { id: "app", labelKey: "fontMenu.mouseApp", titleKey: "fontMenu.mouseAppTitle" },
] as const;
</script>

<template>
  <div class="d-flex flex-column gap-2">
    <div class="btn-group" role="group" :aria-label="t('fontMenu.mouseLabel')">
      <label v-for="mode in MOUSE_MODES" :key="mode.id" class="btn-check btn-outline theme-secondary" :title="t(mode.titleKey)">
        <input v-model="settings.mouseMode" type="radio" name="mouse-mode" autocomplete="off" :value="mode.id" />
        {{ t(mode.labelKey) }}
      </label>
    </div>
    <div class="form-text">
      <template v-if="settings.mouseMode === 'select'">{{ t("fontMenu.mouseSelectHelpBefore") }}<kbd class="mono">⌘C</kbd>{{ t("fontMenu.mouseSelectHelpAfter") }}</template>
      <template v-else>{{ t("fontMenu.mouseAppHelpBefore") }}<kbd class="mono">⌥</kbd>{{ t("fontMenu.mouseAppHelpAfter") }}</template>
    </div>
  </div>
</template>
