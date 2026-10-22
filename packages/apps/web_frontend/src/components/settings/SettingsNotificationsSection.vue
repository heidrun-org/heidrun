<script setup lang="ts">
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

/** The blocks of the information card of the reminder for an agent that stays blocked, in the order of the card. */
const BLOCKED_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.notifyBlocked.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.notifyBlocked.how" },
] as const;

/** The blocks of the information card of the notification about the context of an agent, in the order of the card. */
const CONTEXT_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.notifyContext.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.notifyContext.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.notifyContext.off" },
] as const;

/** The blocks of the information card of the notification about the quota of Claude, in the order of the card. */
const QUOTA_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.notifyQuota.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.notifyQuota.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.notifyQuota.off" },
] as const;

/** The blocks of the information card of the summary of the day, in the order of the card. */
const EVENING_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.notifyEvening.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.notifyEvening.how" },
] as const;

/** The blocks of the information card of the quiet hours, in the order of the card. */
const QUIET_HOURS_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.quietHours.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.quietHours.how" },
] as const;

/** The blocks of the information card of the status item in the macOS menu bar, in the order of the card. */
const STATUS_ITEM_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.showStatusItem.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.showStatusItem.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.showStatusItem.off" },
] as const;
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="d-flex flex-column gap-2" data-option="notifBlockedMin">
      <div class="d-flex align-items-center gap-2">
        <label class="form-label m-0" for="notification-blocked">{{ t("fontMenu.notifyBlocked") }}</label>
        <SettingsOptionHelp title-key="fontMenu.notifyBlocked" :blocks="BLOCKED_HELP_BLOCKS" />
      </div>
      <select id="notification-blocked" v-model.number="settings.notifBlockedMin" class="form-control w-auto">
        <option :value="0">{{ t("fontMenu.neverLower") }}</option>
        <option :value="2">{{ t("fontMenu.minutes", { minutes: 2 }) }}</option>
        <option :value="5">{{ t("fontMenu.minutes", { minutes: 5 }) }}</option>
        <option :value="10">{{ t("fontMenu.minutes", { minutes: 10 }) }}</option>
        <option :value="30">{{ t("fontMenu.minutes", { minutes: 30 }) }}</option>
      </select>
    </div>
    <SettingsSwitchRow v-model="settings.notifContext" :label="t('fontMenu.notifyContext')" data-option="notifContext">
      <SettingsOptionHelp title-key="fontMenu.notifyContext" :blocks="CONTEXT_HELP_BLOCKS" />
    </SettingsSwitchRow>
    <SettingsSwitchRow v-model="settings.notifQuota" :label="t('fontMenu.notifyQuota')" data-option="notifQuota">
      <SettingsOptionHelp title-key="fontMenu.notifyQuota" :blocks="QUOTA_HELP_BLOCKS" />
    </SettingsSwitchRow>
    <div class="d-flex flex-column gap-2" data-option="notifEvening">
      <div class="d-flex align-items-center gap-2">
        <label class="form-label m-0" for="notification-evening">{{ t("fontMenu.notifyEvening") }}</label>
        <SettingsOptionHelp title-key="fontMenu.notifyEvening" :blocks="EVENING_HELP_BLOCKS" />
      </div>
      <input id="notification-evening" v-model.lazy="settings.notifEvening" class="form-control w-auto mono" size="5" placeholder="18:30" />
    </div>
    <div class="d-flex flex-column gap-2" data-option="quietHours">
      <div class="d-flex align-items-center gap-2">
        <label class="form-label m-0" for="quiet-hours-from">{{ t("fontMenu.quietHours") }}</label>
        <SettingsOptionHelp title-key="fontMenu.quietHours" :blocks="QUIET_HOURS_HELP_BLOCKS" />
      </div>
      <div class="d-flex align-items-center gap-2">
        <input id="quiet-hours-from" v-model.lazy="settings.quietFrom" class="form-control w-auto mono" size="5" placeholder="20:00" />
        →
        <input v-model.lazy="settings.quietTo" class="form-control w-auto mono" size="5" placeholder="08:00" :aria-label="t('fontMenu.quietHours')" />
      </div>
    </div>
    <SettingsSwitchRow v-model="settings.showStatusItem" :label="t('fontMenu.showStatusItem')" data-option="showStatusItem">
      <SettingsOptionHelp title-key="fontMenu.showStatusItem" :blocks="STATUS_ITEM_HELP_BLOCKS" />
    </SettingsSwitchRow>
  </div>
</template>
