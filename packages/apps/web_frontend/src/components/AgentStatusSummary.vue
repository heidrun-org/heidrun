<script setup lang="ts">
import { computed, ref } from "vue";
import { allPanes, counts, paneFullName, selectPane } from "../stores/session";
import { t } from "../i18n/index";
import { useStatusCard } from "../lib/status_card";
import type { AgentInfo, AgentStatus } from "../lib/types";

// The three agent status counters in the status bar: blocked, working, done.
// A click on them shows a card with one row per agent, grouped by status. A click on a row selects the pane of the agent.
type CountedStatus = Extract<AgentStatus, "blocked" | "working" | "done">;
const STATUSES: CountedStatus[] = ["blocked", "working", "done"];

const root = ref<HTMLElement | null>(null);
const { isOpen, toggle, close, onFocusOut } = useStatusCard(root);

function selectAgent(agent: AgentInfo) {
  selectPane(agent);
  close();
}

const groups = computed(() =>
  STATUSES.map((status) => ({
    status,
    agents: allPanes.value.filter((p: AgentInfo) => p.agent && p.agent_status === status),
  })),
);
</script>

<template>
  <span
    ref="root"
    class="agent-status"
    tabindex="0"
    @click="toggle"
    @keydown.enter.self.prevent="toggle"
    @keydown.space.self.prevent="toggle"
    @focusout="onFocusOut"
  >
    <span v-for="status in STATUSES" :key="status" class="counter">
      <span class="dot" :class="status"></span>{{ t("statusBar." + status, { count: counts[status] }) }}
    </span>
    <span v-if="isOpen" class="card" role="tooltip" @click.stop>
      <span v-for="group in groups" :key="group.status" class="group">
        <span class="group-title">
          <span class="dot" :class="group.status"></span>{{ t("statusBar." + group.status + "Title") }}
        </span>
        <span v-if="group.agents.length === 0" class="empty">{{ t("statusBar.noAgent") }}</span>
        <button v-for="agent in group.agents" :key="agent.pane_id" class="row" @click="selectAgent(agent)">
          {{ paneFullName(agent) }}
        </button>
      </span>
    </span>
  </span>
</template>

<style scoped>
.agent-status { position: relative; align-self: stretch; margin: 0 -11px; padding: 0 11px; display: flex; align-items: center; gap: 12px; cursor: pointer; outline-offset: 3px; }
.counter { display: flex; align-items: center; gap: 6px; }
.card {
  display: flex; position: absolute; bottom: calc(100% + 4px); right: 11px; z-index: 20; width: 340px;
  flex-direction: column; gap: 14px; padding: 16px 18px; white-space: normal;
  border: 1px solid var(--line-modal); border-radius: 8px; background: var(--side); color: var(--text-2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); font-size: var(--font-size);
}
.card::after {
  content: ""; position: absolute; top: 100%; right: 18px; width: 10px; height: 10px; margin-top: -6px;
  transform: rotate(45deg); border: solid var(--line-modal); border-width: 0 1px 1px 0; background: var(--side);
}
.group { display: flex; flex-direction: column; gap: 4px; }
.group-title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text); }
.empty { padding-left: 16px; color: var(--muted); }
.row {
  padding: 3px 0 3px 16px; border: 0; background: none; color: var(--text-2);
  font: inherit; text-align: left; cursor: pointer;
}
.row:hover { color: var(--text); text-decoration: underline; }
</style>
