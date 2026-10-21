<script setup lang="ts">
import SettingsOptionHelp from './SettingsOptionHelp.vue';
import { ThemePalette } from '../../design/theme_palette';
import { t } from '../../i18n/index';

const teamHelp = [
	{ titleKey: 'settingsHelp.whatTitle', textKey: 'settingsHelp.colorTeam.what' },
	{ titleKey: 'settingsHelp.howTitle', textKey: 'settingsHelp.colorTeam.how' },
];
</script>

<template>
  <div class="d-flex flex-column gap-2" data-option="colorTeam">
    <div class="d-flex align-items-center gap-2">
      <h4 class="form-label m-0">{{ t('settingsDesign.colorTeam') }}</h4>
      <SettingsOptionHelp title-key="settingsDesign.colorTeam" :blocks="teamHelp" />
    </div>
    <div class="list-group">
      <button
        v-for="team in ThemePalette.COLOR_TEAMS"
        :key="team.id"
        type="button"
        class="list-group-item list-group-item-action text-start"
        :class="{ active: ThemePalette.selectedTeam.value === team.id }"
        :aria-pressed="ThemePalette.selectedTeam.value === team.id"
        @click="ThemePalette.selectTeam(team.id)"
      >
        <span class="d-block fw-semibold">{{ t(`settingsDesign.teams.${team.id}.name`) }}</span>
        <span class="d-block small text-body-secondary">{{ t(`settingsDesign.teams.${team.id}.description`) }}</span>
      </button>
    </div>
  </div>
</template>
