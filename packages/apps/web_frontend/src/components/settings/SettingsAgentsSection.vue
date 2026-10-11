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

function onKeydown(event: KeyboardEvent, agent: AgentDefinition) {
  if (event.key !== " " && event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  if (event.repeat) {
    return;
  }
  toggleOwned(agent);
}
</script>

<template>
  <div class="section">
    <p class="lead">{{ t("settingsAgents.lead") }}</p>
    <div class="list">
      <div
        v-for="agent in AGENTS"
        :key="agent.id"
        class="row"
        role="switch"
        tabindex="0"
        :aria-checked="isOwned(agent)"
        :aria-labelledby="`agent-${agent.id}`"
        @click="toggleOwned(agent)"
        @keydown="onKeydown($event, agent)"
      >
        <span :id="`agent-${agent.id}`" class="name">{{ agent.name }}</span>
        <span class="switch" :class="{ on: isOwned(agent) }" aria-hidden="true"><span class="knob"></span></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section { display: flex; flex-direction: column; gap: 12px; }
.lead { margin: 0; font-size: var(--font-size); color: var(--text-2); line-height: 1.5; }
.list { border: 1px solid var(--line); border-radius: 10px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--line); cursor: pointer; }
.row:last-child { border-bottom: 0; }
.row:focus-visible { outline: 2px solid var(--done); outline-offset: -2px; border-radius: 10px; }
.name { font-size: var(--font-size); font-weight: 600; }
.switch { position: relative; flex-shrink: 0; width: 38px; height: 22px; border-radius: 11px; background: var(--line-strong); transition: background 0.15s; }
.switch.on { background: var(--done); }
.knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
.switch.on .knob { transform: translateX(16px); }
</style>
