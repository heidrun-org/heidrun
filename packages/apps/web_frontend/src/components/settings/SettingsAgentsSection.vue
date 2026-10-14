<script setup lang="ts">
import { settings } from "../../stores/settings";
import { AGENTS, type AgentDefinition } from "../../lib/agents";
import { t } from "../../i18n/index";

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
  </div>
</template>
