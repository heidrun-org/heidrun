<script setup lang="ts">
import InstalledSkillsList from "./skills/InstalledSkillsList.vue";
import SkillsWindow from "./skills/SkillsWindow.vue";
import { closeInstalledSkillModal } from "../stores/skills";
import { t } from "../i18n/index";
</script>

<template>
  <SkillsWindow :title="t('settingsSkills.installedTitle')" :help="t('settingsSkills.installedHelp')" @close="closeInstalledSkillModal">
    <InstalledSkillsList />
  </SkillsWindow>
</template>
