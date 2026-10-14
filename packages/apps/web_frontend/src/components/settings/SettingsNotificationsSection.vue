<script setup lang="ts">
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div>
      <label class="form-label" for="notification-blocked">{{ t("fontMenu.notifyBlocked") }}</label>
      <select id="notification-blocked" v-model.number="settings.notifBlockedMin" class="form-control w-auto">
        <option :value="0">{{ t("fontMenu.neverLower") }}</option>
        <option :value="2">{{ t("fontMenu.minutes", { minutes: 2 }) }}</option>
        <option :value="5">{{ t("fontMenu.minutes", { minutes: 5 }) }}</option>
        <option :value="10">{{ t("fontMenu.minutes", { minutes: 10 }) }}</option>
        <option :value="30">{{ t("fontMenu.minutes", { minutes: 30 }) }}</option>
      </select>
    </div>
    <SettingsSwitchRow v-model="settings.notifContext" :label="t('fontMenu.notifyContext')" />
    <SettingsSwitchRow v-model="settings.notifQuota" :label="t('fontMenu.notifyQuota')" />
    <div>
      <label class="form-label" for="notification-evening">{{ t("fontMenu.notifyEvening") }}</label>
      <input id="notification-evening" v-model.lazy="settings.notifEvening" class="form-control w-auto mono" size="5" placeholder="18:30" />
    </div>
    <div>
      <label class="form-label" for="quiet-hours-from">{{ t("fontMenu.quietHours") }}</label>
      <div class="d-flex align-items-center gap-2">
        <input id="quiet-hours-from" v-model.lazy="settings.quietFrom" class="form-control w-auto mono" size="5" placeholder="20:00" />
        →
        <input v-model.lazy="settings.quietTo" class="form-control w-auto mono" size="5" placeholder="08:00" :aria-label="t('fontMenu.quietHours')" />
      </div>
      <div class="form-text">{{ t("fontMenu.quietHoursHelp") }}</div>
    </div>
    <SettingsSwitchRow v-model="settings.showStatusItem" :label="t('fontMenu.showStatusItem')" />
  </div>
</template>
