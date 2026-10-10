<script setup lang="ts">
import Icon from "../Icon.vue";
import {
  agentNames,
  deleteSkill,
  inspectInstalled,
  installedKey,
  isSkillBusy,
  linkKey,
  linkSkillForAgent,
  missingAgents,
  originLabel,
  type InstalledSkill,
} from "../../stores/skills";
import { t } from "../../i18n/index";

const props = defineProps<{ skill: InstalledSkill }>();

/** The origin of the installed skill, then the names of the agents that have it. */
function detailLabel(): string {
  return [originLabel(props.skill), ...agentNames(props.skill)].join(" · ");
}

function placeLabel(): string {
  return t(props.skill.level === "workspace" ? "settingsSkills.placeWorkspace" : "settingsSkills.placeUser");
}
</script>

<template>
  <div class="row">
    <div class="meta">
      <div class="name">{{ skill.name }}</div>
      <div class="sub">{{ detailLabel() }}</div>
    </div>
    <span class="place">{{ placeLabel() }}</span>
    <button class="btn" @click="inspectInstalled(skill)"><Icon name="eye" /> {{ t("settingsSkills.inspect") }}</button>
    <button
      v-for="agent in missingAgents(skill)"
      :key="agent.id"
      class="btn"
      :disabled="isSkillBusy(linkKey(skill, agent.id))"
      :aria-busy="isSkillBusy(linkKey(skill, agent.id))"
      :title="t('settingsSkills.addLinkTitle', { agent: agent.name })"
      @click="linkSkillForAgent(skill, agent.id)"
    >
      <span v-if="isSkillBusy(linkKey(skill, agent.id))" class="spinner" aria-hidden="true"></span><Icon v-else name="link-45deg" />
      {{ t("settingsSkills.addLink", { agent: agent.name }) }}
    </button>
    <button class="btn danger" :disabled="isSkillBusy(installedKey(skill))" :aria-busy="isSkillBusy(installedKey(skill))" @click="deleteSkill(skill)">
      <span v-if="isSkillBusy(installedKey(skill))" class="spinner" aria-hidden="true"></span><Icon v-else name="trash" />
      {{ t("settingsSkills.delete") }}
    </button>
  </div>
</template>
