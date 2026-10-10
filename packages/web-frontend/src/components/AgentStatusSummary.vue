<script setup lang="ts">
import { computed } from "vue";
import { allPanes, counts, paneFullName, selectPane } from "../stores/session";
import { t } from "../i18n/index";
import type { AgentInfo, AgentStatus } from "../lib/types";

// The three agent status counters in the status bar: blocked, working, done.
// Hovering or focusing them shows a card with one row per agent, grouped by status.
type CountedStatus = Extract<AgentStatus, "blocked" | "working" | "done">;
const STATUSES: CountedStatus[] = ["blocked", "working", "done"];

const groups = computed(() =>
  STATUSES.map((status) => ({
    status,
    agents: allPanes.value.filter((p: AgentInfo) => p.agent && p.agent_status === status),
  })),
);
</script>

<template>
  <span class="agent-status" tabindex="0">
    <span v-for="status in STATUSES" :key="status" class="counter">
      <span class="dot" :class="status"></span>{{ t("statusBar." + status, { count: counts[status] }) }}
    </span>
    <span class="card" role="tooltip">
      <span v-for="group in groups" :key="group.status" class="group">
        <span class="group-title">
          <span class="dot" :class="group.status"></span>{{ t("statusBar." + group.status + "Title") }}
        </span>
        <span v-if="group.agents.length === 0" class="empty">{{ t("statusBar.noAgent") }}</span>
        <button v-for="agent in group.agents" :key="agent.pane_id" class="row" @click="selectPane(agent)">
          {{ paneFullName(agent) }}
        </button>
      </span>
    </span>
  </span>
</template>

<style scoped>
.agent-status { position: relative; display: flex; align-items: center; gap: 12px; cursor: default; outline-offset: 3px; }
.counter { display: flex; align-items: center; gap: 6px; }
.card {
  display: flex; visibility: hidden; transition: visibility 0s linear 0.2s; position: absolute; bottom: calc(100% + 12px); right: 0; z-index: 20; width: 340px;
  flex-direction: column; gap: 14px; padding: 16px 18px; white-space: normal;
  border: 1px solid var(--line-modal); border-radius: 8px; background: var(--panel); color: var(--text-2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); font-size: 14.5px;
}
.card::after {
  content: ""; position: absolute; top: 100%; right: 18px; width: 10px; height: 10px; margin-top: -6px;
  transform: rotate(45deg); border: solid var(--line-modal); border-width: 0 1px 1px 0; background: var(--panel);
}
.agent-status:hover .card, .agent-status:focus-visible .card { visibility: visible; transition-delay: 0s; }
.group { display: flex; flex-direction: column; gap: 4px; }
.group-title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text); }
.empty { padding-left: 16px; color: var(--muted); }
.row {
  padding: 3px 0 3px 16px; border: 0; background: none; color: var(--text-2);
  font: inherit; text-align: left; cursor: pointer;
}
.row:hover { color: var(--text); text-decoration: underline; }
</style>
