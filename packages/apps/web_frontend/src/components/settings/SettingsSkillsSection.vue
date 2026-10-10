<script setup lang="ts">
import { onMounted, watch } from "vue";
import FindSkills from "./skills/FindSkills.vue";
import InstalledSkillsList from "./skills/InstalledSkillsList.vue";
import SkillsLevelSwitch from "./skills/SkillsLevelSwitch.vue";
import SkillsNoAgentNotice from "./skills/SkillsNoAgentNotice.vue";
import { settings } from "../../stores/settings";
import { selectedWorkspace } from "../../stores/session";
import { loadSkills } from "../../stores/skills";

onMounted(loadSkills);
// The skills of the workspace level follow the selected workspace.
watch(() => selectedWorkspace.value?.workspace_id, loadSkills);
</script>

<template>
  <div class="section skillsSection">
    <SkillsLevelSwitch />
    <SkillsNoAgentNotice v-if="settings.ownedAgents.length === 0" />
    <InstalledSkillsList />
    <FindSkills />
  </div>
</template>

<style src="./skills/skills_section.css"></style>

<style scoped>
.section { display: flex; flex-direction: column; gap: 10px; }
</style>
