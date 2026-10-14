<script setup lang="ts">
import { computed } from "vue";
import Icon from "../Icon.vue";
import InformationCard from "../InformationCard.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { timeOptions } from "../../lib/format";
import { LANGUAGES, locale, t } from "../../i18n/index";

const TIME_FORMATS = [
  { id: "auto", labelKey: "settingsGeneral.timeAuto" },
  { id: "12h", labelKey: "settingsGeneral.time12" },
  { id: "24h", labelKey: "settingsGeneral.time24" },
] as const;

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const dayNames = computed(() =>
  WEEK_ORDER.map((day) => ({
    day,
    // 2000-01-02 is a Sunday: adding `day` days gives the day numbered like Date.getDay().
    name: new Date(2000, 0, 2 + day).toLocaleDateString(locale.value, { weekday: "short" }),
  })),
);

/** Adds the day to the working days, or removes it. The last working day cannot be removed, so the checkbox stays checked. */
function toggleDay(day: number, event: Event) {
  const days = settings.workingDays;
  if (days.includes(day)) {
    if (days.length > 1) {
      settings.workingDays = days.filter((d) => d !== day);
    }
  } else {
    settings.workingDays = [...days, day].sort((a, b) => a - b);
  }
  (event.target as HTMLInputElement).checked = settings.workingDays.includes(day);
}

const timeExample = computed(() => {
  const time = new Date(2000, 0, 1, 17, 29).toLocaleTimeString(locale.value, timeOptions());
  return t("settingsGeneral.timeExample", { time });
});
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.languageTitle") }}</h4>
      <div class="btn-group" role="group" :aria-label="t('languageMenu.menuLabel')">
        <label
          v-for="o in LANGUAGES"
          :key="o.id"
          class="btn-check btn-outline theme-secondary"
          :title="t('languageMenu.useLanguage', { language: o.label })"
        >
          <input v-model="settings.language" type="radio" name="language" autocomplete="off" :value="o.id" />
          {{ o.label }}
        </label>
      </div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.timeFormatTitle") }}</h4>
      <div class="btn-group" role="group" :aria-label="t('settingsGeneral.timeFormatLabel')">
        <label v-for="f in TIME_FORMATS" :key="f.id" class="btn-check btn-outline theme-secondary">
          <input v-model="settings.timeFormat" type="radio" name="time-format" autocomplete="off" :value="f.id" />
          {{ t(f.labelKey) }}
        </label>
      </div>
      <div class="form-text">{{ timeExample }}</div>
      <div class="form-text">{{ t("settingsGeneral.timeHelp") }}</div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.workingDaysTitle") }}</h4>
      <div class="btn-group" role="group" :aria-label="t('settingsGeneral.workingDaysLabel')">
        <label v-for="d in dayNames" :key="d.day" class="btn-check btn-outline theme-secondary">
          <input type="checkbox" autocomplete="off" :checked="settings.workingDays.includes(d.day)" @change="toggleDay(d.day, $event)" />
          {{ d.name }}
        </label>
      </div>
      <div class="form-text">{{ t("settingsGeneral.workingDaysHelp") }}</div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.askBeforeClosingTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.confirmWorkspaceClose" :label="t('settingsGeneral.confirmWorkspaceClose')" />
      <SettingsSwitchRow v-model="settings.confirmTabClose" :label="t('settingsGeneral.confirmTabClose')" />
      <SettingsSwitchRow v-model="settings.confirmPaneClose" :label="t('settingsGeneral.confirmPaneClose')" />
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.askBeforeDeletingTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.confirmSavedSearchDelete" :label="t('settingsGeneral.confirmSavedSearchDelete')" />
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.quitTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.keepAgentsRunningAfterQuit" :label="t('settingsGeneral.keepAgentsRunning')">
        <InformationCard :label="t('settingsGeneral.keepAgentsRunningHelpLabel')" placement="bottom">
          <span class="text-body-secondary" role="img" :aria-label="t('settingsGeneral.keepAgentsRunningHelpLabel')">
            <Icon name="question-circle" />
          </span>
          <template #card>
            <div class="list-group list-group-flush">
              <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
                <Icon name="question-circle" />
                {{ t("settingsGeneral.keepAgentsRunning") }}
              </div>
              <div class="list-group-item text-body-secondary">{{ t("settingsGeneral.keepAgentsRunningHelp") }}</div>
            </div>
          </template>
        </InformationCard>
      </SettingsSwitchRow>
    </div>
  </div>
</template>
