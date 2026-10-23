<script setup lang="ts">
import SettingsOptionHelp from './SettingsOptionHelp.vue';
import { ThemePalette } from '../../design/theme_palette';
import { t } from '../../i18n/index';

const themeHelp = [
	{ titleKey: 'settingsHelp.whatTitle', textKey: 'settingsHelp.colorTheme.what' },
	{ titleKey: 'settingsHelp.howTitle', textKey: 'settingsHelp.colorTheme.how' },
];
</script>

<template>
  <div class="d-flex flex-column gap-2" data-option="colorTheme">
    <div class="d-flex align-items-center gap-2">
      <h4 class="form-label m-0">{{ t('settingsDesign.colorTheme') }}</h4>
      <SettingsOptionHelp title-key="settingsDesign.colorTheme" :blocks="themeHelp" />
    </div>
    <div class="list-group">
      <button
        v-for="colorTheme in ThemePalette.COLOR_THEMES"
        :key="colorTheme.id"
        type="button"
        class="list-group-item list-group-item-action text-start"
        :class="{ active: ThemePalette.selectedTheme.value === colorTheme.id }"
        :aria-pressed="ThemePalette.selectedTheme.value === colorTheme.id"
        @click="ThemePalette.selectTheme(colorTheme.id)"
      >
        <span class="d-block fw-semibold">{{ t(`settingsDesign.themes.${colorTheme.id}.name`) }}</span>
        <span
          class="d-block small"
          :class="{ 'text-body-secondary': ThemePalette.selectedTheme.value !== colorTheme.id }"
        >{{ t(`settingsDesign.themes.${colorTheme.id}.description`) }}</span>
      </button>
    </div>
  </div>
</template>
