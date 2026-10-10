<script setup lang="ts">
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";
</script>

<template>
  <div class="section">
    <div class="seg" role="radiogroup" :aria-label="t('fontMenu.mouseLabel')">
      <button :title="t('fontMenu.mouseSelectTitle')" role="radio" :aria-checked="settings.mouseMode === 'select'" :class="{ on: settings.mouseMode === 'select' }" @click="settings.mouseMode = 'select'">{{ t("fontMenu.mouseSelect") }}</button>
      <button :title="t('fontMenu.mouseAppTitle')" role="radio" :aria-checked="settings.mouseMode === 'app'" :class="{ on: settings.mouseMode === 'app' }" @click="settings.mouseMode = 'app'">{{ t("fontMenu.mouseApp") }}</button>
    </div>
    <div class="keys">
      <template v-if="settings.mouseMode === 'select'">{{ t("fontMenu.mouseSelectHelpBefore") }}<kbd>⌘C</kbd>{{ t("fontMenu.mouseSelectHelpAfter") }}</template>
      <template v-else>{{ t("fontMenu.mouseAppHelpBefore") }}<kbd>⌥</kbd>{{ t("fontMenu.mouseAppHelpAfter") }}</template>
    </div>
  </div>
</template>

<style scoped>
.section { display: flex; flex-direction: column; gap: 10px; }
</style>
