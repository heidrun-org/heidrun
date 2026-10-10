<script setup lang="ts">
import SkillsFold from "./SkillsFold.vue";
import InstalledSkillRow from "./InstalledSkillRow.vue";
import { settings } from "../../../stores/settings";
import { installedKey, skills } from "../../../stores/skills";
import { t } from "../../../i18n/index";
</script>

<template>
  <SkillsFold
    :open="settings.skillsInstalledOpen"
    :heading="t('settingsSkills.installedHeading', { total: skills.installed.length })"
    @toggle="settings.skillsInstalledOpen = !settings.skillsInstalledOpen"
  >
    <p v-if="skills.installed.length === 0" class="keys">{{ t("settingsSkills.installedEmpty") }}</p>
    <div v-else class="list">
      <InstalledSkillRow v-for="skill in skills.installed" :key="installedKey(skill)" :skill="skill" />
    </div>
  </SkillsFold>
</template>
