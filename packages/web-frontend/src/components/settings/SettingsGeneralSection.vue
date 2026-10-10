<script setup lang="ts">
import { computed } from "vue";
import Icon from "../Icon.vue";
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

function toggleDay(day: number) {
  const days = settings.workingDays;
  if (days.includes(day)) {
    if (days.length > 1) {
      settings.workingDays = days.filter((d) => d !== day);
    }
    return;
  }
  settings.workingDays = [...days, day].sort((a, b) => a - b);
}

const timeExample = computed(() => {
  const time = new Date(2000, 0, 1, 17, 29).toLocaleTimeString(locale.value, timeOptions());
  return t("settingsGeneral.timeExample", { time });
});
</script>

<template>
  <div class="section">
    <h4>{{ t("settingsGeneral.languageTitle") }}</h4>
    <div class="list" role="radiogroup" :aria-label="t('languageMenu.menuLabel')">
      <button
        v-for="o in LANGUAGES"
        :key="o.id"
        class="item"
        role="radio"
        :title="t('languageMenu.useLanguage', { language: o.label })"
        :aria-checked="settings.language === o.id"
        @click="settings.language = o.id"
      >
        <span class="label">{{ o.label }}</span>
        <Icon v-if="settings.language === o.id" name="check2" />
      </button>
    </div>

    <h4>{{ t("settingsGeneral.timeFormatTitle") }}</h4>
    <div class="seg" role="radiogroup" :aria-label="t('settingsGeneral.timeFormatLabel')">
      <button
        v-for="f in TIME_FORMATS"
        :key="f.id"
        role="radio"
        :aria-checked="settings.timeFormat === f.id"
        :class="{ on: settings.timeFormat === f.id }"
        @click="settings.timeFormat = f.id"
      >
        {{ t(f.labelKey) }}
      </button>
    </div>
    <div class="keys">{{ timeExample }}</div>
    <div class="keys">{{ t("settingsGeneral.timeHelp") }}</div>

    <h4>{{ t("settingsGeneral.workingDaysTitle") }}</h4>
    <div class="seg" role="group" :aria-label="t('settingsGeneral.workingDaysLabel')">
      <button
        v-for="d in dayNames"
        :key="d.day"
        :aria-pressed="settings.workingDays.includes(d.day)"
        :class="{ on: settings.workingDays.includes(d.day) }"
        @click="toggleDay(d.day)"
      >
        {{ d.name }}
      </button>
    </div>
    <div class="keys">{{ t("settingsGeneral.workingDaysHelp") }}</div>
  </div>
</template>

<style scoped>
.section { display: flex; flex-direction: column; gap: 10px; }
h4 { margin: 8px 0 0; font-size: 13px; font-weight: 600; color: var(--text-2); }
h4:first-child { margin-top: 0; }
.list { display: flex; flex-direction: column; gap: 2px; max-width: 280px; }
.item {
  display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border: none; border-radius: 8px;
  background: transparent; color: var(--text); font-size: 13px; text-align: left;
}
.item:hover { background: var(--hover); }
.label { flex: 1; }
</style>
