<script setup lang="ts">
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";
</script>

<template>
  <div class="section">
    <label class="nrow">
      <span>{{ t("fontMenu.notifyBlocked") }}</span>
      <select v-model.number="settings.notifBlockedMin">
        <option :value="0">{{ t("fontMenu.neverLower") }}</option>
        <option :value="2">{{ t("fontMenu.minutes", { minutes: 2 }) }}</option>
        <option :value="5">{{ t("fontMenu.minutes", { minutes: 5 }) }}</option>
        <option :value="10">{{ t("fontMenu.minutes", { minutes: 10 }) }}</option>
        <option :value="30">{{ t("fontMenu.minutes", { minutes: 30 }) }}</option>
      </select>
    </label>
    <label class="nrow"><span>{{ t("fontMenu.notifyContext") }}</span><input v-model="settings.notifContext" type="checkbox" /></label>
    <label class="nrow"><span>{{ t("fontMenu.notifyQuota") }}</span><input v-model="settings.notifQuota" type="checkbox" /></label>
    <label class="nrow"><span>{{ t("fontMenu.notifyEvening") }}</span><input v-model.lazy="settings.notifEvening" class="time" placeholder="18:30" /></label>
    <label class="nrow">
      <span>{{ t("fontMenu.quietHours") }}</span>
      <span class="range"><input v-model.lazy="settings.quietFrom" class="time" placeholder="20:00" /> → <input v-model.lazy="settings.quietTo" class="time" placeholder="08:00" /></span>
    </label>
    <div class="keys">{{ t("fontMenu.quietHoursHelp") }}</div>
  </div>
</template>

<style scoped>
.section { display: flex; flex-direction: column; gap: 10px; }
.nrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--text-2); }
.nrow select, .nrow .time { height: 26px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--bg); color: var(--text); font-size: 12px; padding: 0 6px; }
.nrow .time { width: 58px; text-align: center; font-family: var(--mono); }
.nrow input[type="checkbox"] { accent-color: var(--done); }
.range { display: flex; align-items: center; gap: 4px; }
</style>
