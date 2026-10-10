<script setup lang="ts">
import FindSkills from "./skills/FindSkills.vue";
import SkillsLevelSwitch from "./skills/SkillsLevelSwitch.vue";
import SkillsNoAgentNotice from "./skills/SkillsNoAgentNotice.vue";
import SkillsWindow from "./skills/SkillsWindow.vue";
import { settings } from "../stores/settings";
import { closeFindNewSkillsModal } from "../stores/skills";
import { t } from "../i18n/index";
</script>

<template>
  <SkillsWindow :title="t('settingsSkills.findTitle')" :help="t('settingsSkills.findHelp')" @close="closeFindNewSkillsModal">
    <SkillsLevelSwitch />
    <SkillsNoAgentNotice v-if="settings.ownedAgents.length === 0" />
    <FindSkills />
  </SkillsWindow>
</template>
