<script setup lang="ts">
import Icon from "../Icon.vue";
import InformationCard from "../InformationCard.vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { AGENTS, type AgentDefinition } from "../../lib/agents";
import { t } from "../../i18n/index";

/** The three commands that the pane of a new tab can run, in the order of the buttons. */
const COMMANDS = [
  { id: "terminal", labelKey: "settingsNewTab.terminalLabel", titleKey: "settingsNewTab.terminalTitle" },
  { id: "claude", labelKey: "settingsNewTab.claudeLabel", titleKey: "settingsNewTab.claudeTitle" },
  { id: "codex", labelKey: "settingsNewTab.codexLabel", titleKey: "settingsNewTab.codexTitle" },
] as const;

function isOwned(agent: AgentDefinition): boolean {
  return settings.ownedAgents.includes(agent.id);
}

function toggleOwned(agent: AgentDefinition) {
  const others = settings.ownedAgents.filter((id) => id !== agent.id);
  settings.ownedAgents = isOwned(agent) ? others : [...others, agent.id];
}

/** The key Enter switches the focused switch, as the key Space does. Holding the key down switches only once. */
function onEnter(event: KeyboardEvent, agent: AgentDefinition) {
  event.preventDefault();
  if (event.repeat) {
    return;
  }
  toggleOwned(agent);
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <p class="m-0">{{ t("settingsAgents.lead") }}</p>
    <div class="list-group">
      <label
        v-for="agent in AGENTS"
        :key="agent.id"
        class="list-group-item list-group-item-action d-flex align-items-center justify-content-between"
      >
        <span class="fw-semibold">{{ agent.name }}</span>
        <span class="switch">
          <input type="checkbox" role="switch" :checked="isOwned(agent)" @change="toggleOwned(agent)" @keydown.enter="onEnter($event, agent)" />
        </span>
      </label>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsNewTab.commandTitle") }}</h4>
      <div class="btn-group" role="group" :aria-label="t('settingsNewTab.commandTitle')">
        <label
          v-for="command in COMMANDS"
          :key="command.id"
          class="btn-check btn-outline theme-secondary"
          :title="t(command.titleKey)"
        >
          <input v-model="settings.newTabCommand" type="radio" name="new-tab-command" autocomplete="off" :value="command.id" />
          {{ t(command.labelKey) }}
        </label>
      </div>
      <div class="form-text">{{ t("settingsNewTab.help") }}</div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.quitTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.keepAgentsRunningAfterQuit" :label="t('settingsGeneral.keepAgentsRunning')">
        <InformationCard :label="t('settingsGeneral.keepAgentsRunningHelpLabel')" placement="bottom">
          <span class="text-body-secondary" role="img" :aria-label="t('settingsGeneral.keepAgentsRunningHelpLabel')">
            <Icon name="question-circle" />
          </span>
          <template #card>
            <div class="list-group list-group-flush">
              <div class="list-group-item d-flex align-items-center gap-2 fw-medium">
                <Icon name="question-circle" />
                {{ t("settingsGeneral.keepAgentsRunning") }}
              </div>
              <div class="list-group-item text-body-secondary">{{ t("settingsGeneral.keepAgentsRunningHelp") }}</div>
            </div>
          </template>
        </InformationCard>
      </SettingsSwitchRow>
    </div>
  </div>
</template>
