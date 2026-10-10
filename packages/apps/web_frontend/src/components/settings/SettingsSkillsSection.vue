<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";
import Icon from "../Icon.vue";
import { settings } from "../../stores/settings";
import { selectedWorkspace } from "../../stores/session";
import {
  agentNames,
  deleteSkill,
  inspectInstalled,
  inspectResult,
  installSkill,
  installedKey,
  isInstalledAtLevel,
  linkKey,
  linkSkillForAgent,
  loadSkills,
  missingAgents,
  openAgentsSection,
  originLabel,
  resultKey,
  searchSkills,
  skills,
  type InstalledSkill,
} from "../../stores/skills";
import { t } from "../../i18n/index";

const SEARCH_DELAY_MS = 300;
let searchTimer = 0;

function onSearchInput(event: Event) {
  const query = (event.target as HTMLInputElement).value;
  skills.query = query;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => searchSkills(query), SEARCH_DELAY_MS);
}

/** True while the installation or the deletion of the skill with this key runs. */
function isBusy(key: string): boolean {
  return skills.busyKey === key;
}

/** The origin of an installed skill, then the names of the agents that have it. */
function detailLabel(skill: InstalledSkill): string {
  return [originLabel(skill), ...agentNames(skill)].join(" · ");
}

function placeLabel(skill: InstalledSkill): string {
  return t(skill.level === "workspace" ? "settingsSkills.placeWorkspace" : "settingsSkills.placeUser");
}

onMounted(loadSkills);
onBeforeUnmount(() => window.clearTimeout(searchTimer));
// The skills of the workspace level follow the selected workspace.
watch(() => selectedWorkspace.value?.workspace_id, loadSkills);
</script>

<template>
  <div class="section">
    <div class="level">
      <div>
        <div class="title">{{ t("settingsSkills.levelTitle") }}</div>
        <div class="keys">{{ t("settingsSkills.levelHelp") }}</div>
      </div>
      <div class="seg levelChoice" role="radiogroup" :aria-label="t('settingsSkills.levelLabel')">
        <button
          role="radio"
          :aria-checked="settings.skillsLevel === 'workspace'"
          :class="{ on: settings.skillsLevel === 'workspace' }"
          @click="settings.skillsLevel = 'workspace'"
        >{{ t("settingsSkills.levelWorkspace") }}</button>
        <button
          role="radio"
          :aria-checked="settings.skillsLevel === 'user'"
          :class="{ on: settings.skillsLevel === 'user' }"
          @click="settings.skillsLevel = 'user'"
        >{{ t("settingsSkills.levelUser") }}</button>
      </div>
    </div>

    <div v-if="settings.ownedAgents.length === 0" class="notice">
      <span>{{ t("settingsSkills.noAgent") }}</span>
      <button class="btn" @click="openAgentsSection">{{ t("settingsSkills.openAgents") }}</button>
    </div>

    <button class="fold" :aria-expanded="settings.skillsInstalledOpen" @click="settings.skillsInstalledOpen = !settings.skillsInstalledOpen">
      <Icon :name="settings.skillsInstalledOpen ? 'chevron-down' : 'chevron-right'" />
      <span>{{ t("settingsSkills.installedHeading", { total: skills.installed.length }) }}</span>
    </button>
    <template v-if="settings.skillsInstalledOpen">
      <p v-if="skills.installed.length === 0" class="keys">{{ t("settingsSkills.installedEmpty") }}</p>
      <div v-else class="list">
        <div v-for="skill in skills.installed" :key="installedKey(skill)" class="row">
          <div class="meta">
            <div class="name">{{ skill.name }}</div>
            <div class="sub">{{ detailLabel(skill) }}</div>
          </div>
          <span class="place">{{ placeLabel(skill) }}</span>
          <button class="btn" @click="inspectInstalled(skill)"><Icon name="eye" /> {{ t("settingsSkills.inspect") }}</button>
          <button
            v-for="agent in missingAgents(skill)"
            :key="agent.id"
            class="btn"
            :disabled="isBusy(linkKey(skill, agent.id))"
            :aria-busy="isBusy(linkKey(skill, agent.id))"
            :title="t('settingsSkills.addLinkTitle', { agent: agent.name })"
            @click="linkSkillForAgent(skill, agent.id)"
          >
            <span v-if="isBusy(linkKey(skill, agent.id))" class="spinner" aria-hidden="true"></span><Icon v-else name="link-45deg" />
            {{ t("settingsSkills.addLink", { agent: agent.name }) }}
          </button>
          <button class="btn danger" :disabled="isBusy(installedKey(skill))" :aria-busy="isBusy(installedKey(skill))" @click="deleteSkill(skill)">
            <span v-if="isBusy(installedKey(skill))" class="spinner" aria-hidden="true"></span><Icon v-else name="trash" />
            {{ t("settingsSkills.delete") }}
          </button>
        </div>
      </div>
    </template>

    <button class="fold" :aria-expanded="settings.skillsFindOpen" @click="settings.skillsFindOpen = !settings.skillsFindOpen">
      <Icon :name="settings.skillsFindOpen ? 'chevron-down' : 'chevron-right'" />
      <span>{{ t("settingsSkills.findHeading") }}</span>
    </button>
    <template v-if="settings.skillsFindOpen">
      <input
        class="search"
        type="search"
        :value="skills.query"
        :placeholder="t('settingsSkills.searchPlaceholder')"
        :aria-label="t('settingsSkills.searchLabel')"
        @input="onSearchInput"
      />
      <p v-if="skills.searching" class="keys">{{ t("settingsSkills.searching") }}</p>
      <p v-else-if="skills.searchError !== ''" class="err">{{ skills.searchError }}</p>
      <p v-else-if="skills.searched && skills.results.length === 0" class="keys">{{ t("settingsSkills.noResult") }}</p>
      <div v-if="skills.results.length > 0" class="list">
        <div v-for="result in skills.results" :key="resultKey(result)" class="row">
          <div class="meta">
            <div class="name">{{ result.name }}</div>
            <div class="sub">{{ result.source }} · {{ t("settingsSkills.installs", { total: result.installs.toLocaleString() }) }}</div>
          </div>
          <button class="btn" @click="inspectResult(result)"><Icon name="eye" /> {{ t("settingsSkills.inspect") }}</button>
          <span v-if="isInstalledAtLevel(result)" class="place">{{ t("settingsSkills.installed") }}</span>
          <button
            v-else
            class="btn"
            :disabled="isBusy(resultKey(result))"
            :aria-busy="isBusy(resultKey(result))"
            :title="t(settings.skillsLevel === 'workspace' ? 'settingsSkills.installTitleWorkspace' : 'settingsSkills.installTitleUser')"
            @click="installSkill(result)"
          >
            <span v-if="isBusy(resultKey(result))" class="spinner" aria-hidden="true"></span><Icon v-else name="download" />
            {{ t("settingsSkills.install") }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.section { display: flex; flex-direction: column; gap: 10px; }
.level { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.title { font-weight: 600; font-size: var(--font-size); }
.levelChoice { flex-shrink: 0; width: 280px; }
.fold { display: flex; align-items: center; gap: 6px; width: 100%; padding: 4px 0; background: transparent; border: 0; color: var(--text); font-size: var(--font-size); font-weight: 600; text-align: left; cursor: pointer; }
.fold :deep(.bi) { color: var(--muted); }
.notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 10px; background: var(--tint-warn); color: var(--text-2); font-size: var(--font-size); line-height: 1.5; }
.list { border: 1px solid var(--line); border-radius: 10px; }
.row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.row:last-child { border-bottom: 0; }
.meta { flex: 1; min-width: 0; }
.name { font-size: var(--font-size); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { font-size: var(--font-size); color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.place { flex-shrink: 0; padding: 2px 8px; border-radius: 6px; background: var(--field); color: var(--text-2); font-size: var(--font-size); }
.btn:disabled { opacity: 0.7; cursor: default; }
.btn.danger { color: var(--fail); }
.btn.danger:hover:not(:disabled) { background: #a83a36; border-color: transparent; color: #fff; }
.spinner {
  display: inline-block; width: 1em; height: 1em; flex-shrink: 0; box-sizing: border-box;
  border: 0.15em solid currentcolor; border-right-color: transparent; border-radius: 50%;
  animation: spinner 0.75s linear infinite;
}
@keyframes spinner { to { transform: rotate(360deg); } }
.search { height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--bg); color: var(--text); font-size: var(--font-size); }
.err { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--tint-err); color: var(--fail); font-size: var(--font-size); }
</style>
