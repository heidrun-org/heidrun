<script setup lang="ts">
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

const TTL_OPTIONS = [
  { v: 5, labelKey: "fontMenu.minutes5" },
  { v: 15, labelKey: "fontMenu.minutes15" },
  { v: 60, labelKey: "fontMenu.hour1" },
  { v: 0, labelKey: "fontMenu.never" },
];
</script>

<template>
  <div class="section">
    <div class="seg" role="radiogroup" :aria-label="t('fontMenu.finishedLabel')">
      <button
        v-for="o in TTL_OPTIONS"
        :key="o.v"
        :title="t('fontMenu.finishedTitle')"
        role="radio"
        :aria-checked="settings.finishedTtl === o.v"
        :class="{ on: settings.finishedTtl === o.v }"
        @click="settings.finishedTtl = o.v"
      >{{ t(o.labelKey) }}</button>
    </div>
    <div class="keys">{{ t("fontMenu.finishedHelp") }}</div>
  </div>
</template>

<style scoped>
.section { display: flex; flex-direction: column; gap: 10px; }
</style>
