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
  <div class="d-flex flex-column gap-2">
    <div class="btn-group" role="group" :aria-label="t('fontMenu.finishedLabel')">
      <label v-for="o in TTL_OPTIONS" :key="o.v" class="btn-check btn-outline theme-secondary" :title="t('fontMenu.finishedTitle')">
        <input v-model="settings.finishedTtl" type="radio" name="finished-ttl" autocomplete="off" :value="o.v" />
        {{ t(o.labelKey) }}
      </label>
    </div>
    <div class="form-text">{{ t("fontMenu.finishedHelp") }}</div>
  </div>
</template>
