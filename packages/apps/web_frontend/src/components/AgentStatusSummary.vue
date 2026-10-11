<script setup lang="ts">
import { computed, ref } from "vue";
import { allPanes, counts, paneFullName, selectPane } from "../stores/session";
import { t } from "../i18n/index";
import { useStatusCard } from "../lib/status_card";
import type { AgentInfo, AgentStatus } from "../lib/types";

// The three agent status counters in the status bar: blocked, working, done.
// A click on them shows a Bootstrap dropdown menu with one row per agent, grouped by status.
// A click on a row selects the pane of the agent.
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
  <div
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
    <div
      v-if="isOpen"
      class="dropdown-menu show bottom-100 overflow-y-auto"
      role="menu"
      :style="{ maxHeight: '70vh' }"
      @click.stop
    >
      <template v-for="(group, index) in groups" :key="group.status">
        <div v-if="index > 0" class="dropdown-divider" role="separator"></div>
        <div class="dropdown-header d-flex align-items-center gap-2 fw-semibold">
          <span class="dot" :class="group.status"></span>{{ t("statusBar." + group.status + "Title") }}
        </div>
        <div v-if="group.agents.length === 0" class="dropdown-item-text text-body-secondary">{{ t("statusBar.noAgent") }}</div>
        <button
          v-for="agent in group.agents"
          :key="agent.pane_id"
          type="button"
          class="dropdown-item text-wrap"
          role="menuitem"
          @click="selectAgent(agent)"
        >
          {{ paneFullName(agent) }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.agent-status { align-self: stretch; margin: 0 -11px; padding: 0 11px; display: flex; align-items: center; gap: 12px; cursor: pointer; outline-offset: 3px; }
.counter { display: flex; align-items: center; gap: 6px; }
</style>
