<script setup lang="ts">
import { computed } from "vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
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

/** The blocks of the information card of the language, in the order of the card. */
const LANGUAGE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.language.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.language.how" },
] as const;

/** The blocks of the information card of the time format, in the order of the card. */
const TIME_FORMAT_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.timeFormat.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsGeneral.timeHelp" },
] as const;

/** The blocks of the information card of the working days, in the order of the card. */
const WORKING_DAYS_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.workingDays.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsGeneral.workingDaysHelp" },
] as const;

/** The blocks of the information card of the goat sound, in the order of the card. */
const GOAT_SOUND_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.goatSound.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.goatSound.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.goatSound.off" },
] as const;

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
    <div class="d-flex flex-column gap-2" data-option="language">
      <div class="d-flex align-items-center gap-2">
        <h4 class="form-label m-0">{{ t("settingsGeneral.languageTitle") }}</h4>
        <SettingsOptionHelp title-key="settingsGeneral.languageTitle" :blocks="LANGUAGE_HELP_BLOCKS" />
      </div>
      <div class="btn-group" role="group" :aria-label="t('languageMenu.menuLabel')">
        <label
          v-for="o in LANGUAGES"
          :key="o.id"
          class="btn btn-check btn-outline theme-secondary"
          :title="t('languageMenu.useLanguage', { language: o.label })"
        >
          <input v-model="settings.language" type="radio" name="language" autocomplete="off" :value="o.id" />
          {{ o.label }}
        </label>
      </div>
    </div>

    <div class="d-flex flex-column gap-2" data-option="timeFormat">
      <div class="d-flex align-items-center gap-2">
        <h4 class="form-label m-0">{{ t("settingsGeneral.timeFormatTitle") }}</h4>
        <SettingsOptionHelp title-key="settingsGeneral.timeFormatTitle" :blocks="TIME_FORMAT_HELP_BLOCKS" />
      </div>
      <div class="btn-group" role="group" :aria-label="t('settingsGeneral.timeFormatLabel')">
        <label v-for="f in TIME_FORMATS" :key="f.id" class="btn btn-check btn-outline theme-secondary">
          <input v-model="settings.timeFormat" type="radio" name="time-format" autocomplete="off" :value="f.id" />
          {{ t(f.labelKey) }}
        </label>
      </div>
      <div class="form-text">{{ timeExample }}</div>
    </div>

    <div class="d-flex flex-column gap-2" data-option="workingDays">
      <div class="d-flex align-items-center gap-2">
        <h4 class="form-label m-0">{{ t("settingsGeneral.workingDaysTitle") }}</h4>
        <SettingsOptionHelp title-key="settingsGeneral.workingDaysTitle" :blocks="WORKING_DAYS_HELP_BLOCKS" />
      </div>
      <div class="btn-group" role="group" :aria-label="t('settingsGeneral.workingDaysLabel')">
        <label v-for="d in dayNames" :key="d.day" class="btn btn-check btn-outline theme-secondary">
          <input type="checkbox" autocomplete="off" :checked="settings.workingDays.includes(d.day)" @change="toggleDay(d.day, $event)" />
          {{ d.name }}
        </label>
      </div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.soundTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.goatSound" :label="t('settingsGeneral.goatSound')" data-option="goatSound">
        <SettingsOptionHelp title-key="settingsGeneral.goatSound" :blocks="GOAT_SOUND_HELP_BLOCKS" />
      </SettingsSwitchRow>
    </div>
  </div>
</template>
