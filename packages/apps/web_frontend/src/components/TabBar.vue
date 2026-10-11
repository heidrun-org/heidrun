<script setup lang="ts">
import { computed } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import { allPanes, closeTab, finishRename, moveTab, selectTab, startRename, state, tabLabel, tabs } from "../stores/session";
import { remote } from "../stores/claude";
import { useReorder } from "../lib/reorder";
import { onNewPaneClick } from "../stores/newPane";
import { t } from "../i18n/index";

const tabReorder = useReorder("x", (id, at) => moveTab(id, at));

/** The tab ids in the order of the tab bar. */
const tabIds = computed(() => tabs.value.map((tab) => tab.tab_id));

/** True when a pane of the tab has just turned blocked: the status dot of the tab pulses once. */
function isPulsing(tabId: string): boolean {
  return allPanes.value.some((pane) => pane.tab_id === tabId && state.pulse[pane.pane_id] !== undefined);
}

/** True when Remote Control is connected to a pane of the tab. */
function isRemoteControlled(tabId: string): boolean {
  return allPanes.value.some((pane) => pane.tab_id === tabId && remote.byPane[pane.pane_id] === "active");
}
</script>

<template>
  <div class="tab-bar d-flex align-items-center gap-2">
    <ul class="nav nav-tabs" role="tablist" :aria-label="t('tabBar.label')">
      <li v-for="(tab, tabIndex) in tabs" :key="tab.tab_id" class="nav-item position-relative" role="presentation">
        <div v-if="state.renaming === `tab:${tab.tab_id}`" class="nav-link active d-flex align-items-center gap-2">
          <span class="dot" :class="tab.agent_status === 'idle' ? '' : tab.agent_status"></span>
          <InlineRename
            :value="tabLabel(tab.tab_id)"
            :label="t('tabBar.newName')"
            @save="(value) => finishRename('tab', tab.tab_id, value)"
            @cancel="state.renaming = null"
          />
        </div>
        <div
          v-else
          class="nav-link d-flex align-items-center gap-2"
          role="presentation"
          :class="{
            active: tab.tab_id === state.selectedTabId,
            dragging: tabReorder.dragging.value === tab.tab_id,
            'drop-before': tabReorder.gap.value === tabIndex,
            'drop-after': tabReorder.gap.value === tabIndex + 1 && tabIndex === tabs.length - 1,
          }"
          draggable="true"
          @dragstart="tabReorder.onDragStart($event, tab.tab_id)"
          @dragover="tabReorder.onDragOver($event, tabIndex)"
          @drop="tabReorder.onDrop($event, tabIds)"
          @dragend="tabReorder.onDragEnd()"
        >
          <button
            class="tab-main d-flex align-items-center gap-2"
            role="tab"
            :aria-selected="tab.tab_id === state.selectedTabId"
            :title="t('tabBar.tabTitle', { name: tabLabel(tab.tab_id) })"
            @click="selectTab(tab.tab_id)"
            @dblclick="startRename('tab', tab.tab_id)"
          >
            <span class="dot" :class="[tab.agent_status === 'idle' ? '' : tab.agent_status, isPulsing(tab.tab_id) ? 'pulse' : '']"></span>
            <span class="tab-label">{{ tabLabel(tab.tab_id) }}</span>
            <span v-if="isRemoteControlled(tab.tab_id)" class="rc" :title="t('tabBar.remoteControlConnected')">{{ t("tabBar.remoteControlBadge") }}</span>
          </button>
          <ConfirmButton
            icon="x-lg"
            :confirm-label="t('tabBar.closeConfirm')"
            :question="t('tabBar.close', { name: tabLabel(tab.tab_id) })"
            @confirm="closeTab(tab.tab_id)"
          />
        </div>
      </li>
    </ul>
    <button
      class="btn border-0 justify-content-center add"
      :title="t('tabBar.newTabTitle')"
      :aria-label="t('tabBar.newTabTitle')"
      @click="onNewPaneClick"
    ><Icon name="plus-lg" /></button>
  </div>
</template>

<style scoped>
.tab-bar { flex-shrink: 0; min-width: 0; padding-top: 4px; }
/* Bootstrap draws the tabs. These variables give it the colors of the application: the selected tab has the color of the panes
   below it, and the tabs have no border line. */
.nav-tabs {
  --bs-nav-tabs-border-width: 0;
  --bs-nav-tabs-border-radius: 8px;
  --bs-nav-link-padding-x: 12px;
  --bs-nav-link-padding-y: 6px;
  --bs-nav-link-font-weight: 500;
  --bs-nav-link-color: var(--muted);
  --bs-nav-link-hover-color: var(--text-2);
  --bs-nav-tabs-link-active-color: var(--text);
  --bs-nav-tabs-link-active-bg: var(--bg);
  flex-wrap: nowrap; min-width: 0; margin: 0; gap: 2px; overflow-x: auto; scrollbar-width: none;
}
.nav-item { flex: 0 1 auto; min-width: 120px; max-width: 220px; }
.nav-link { width: 100%; }
.nav-link:not(.active):hover { background: var(--overlay-hover); }
.nav-link.active { font-weight: 600; }
.nav-link.dragging { opacity: 0.4; }
.nav-link.drop-before::before, .nav-link.drop-after::after {
  content: ""; position: absolute; top: 4px; bottom: 4px; width: 2px; border-radius: 1px; background: var(--done);
}
.nav-link.drop-before::before { left: -2px; }
.nav-link.drop-after::after { right: -2px; }
.tab-main {
  flex: 1; min-width: 0; padding: 0; border: none; background: transparent; color: inherit; font: inherit; text-align: left;
}
.tab-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc {
  font: 600 var(--font-size) var(--mono); letter-spacing: 0.4px; padding: 1px 5px; border-radius: 4px;
  background: var(--tint-working); color: var(--working);
}
/* As in Visual Studio Code, the close button of the selected tab is always visible, and the close button of another tab shows
   when the mouse is over it. The button keeps its place, so the tabs do not move. */
.nav-link .confirm {
  flex-shrink: 0; width: 16px; min-width: 16px; height: 16px; padding: 0; border-radius: 4px;
  font-size: calc(var(--font-size) * 0.85); color: var(--muted);
}
.nav-link:not(.active) .confirm { opacity: 0; }
.nav-link:not(.active):hover .confirm, .nav-link:not(.active):focus-within .confirm { opacity: 1; }
.nav-link .confirm:hover { background: var(--overlay-hover); color: var(--text); }
.add {
  --bs-btn-padding-x: 0;
  --bs-btn-padding-y: 0;
  --bs-btn-font-size: var(--font-size);
  --bs-btn-font-weight: 400;
  --bs-btn-border-radius: 6px;
  --bs-btn-color: var(--muted);
  --bs-btn-hover-color: var(--text);
  --bs-btn-hover-bg: rgba(var(--wash), 0.08);
  --bs-btn-active-color: var(--text);
  --bs-btn-active-bg: rgba(var(--wash), 0.08);
  --bs-btn-disabled-color: var(--text);
  --bs-btn-disabled-bg: rgba(var(--wash), 0.08);
  --bs-btn-focus-box-shadow: none;
  flex-shrink: 0; width: 28px; height: 28px; line-height: 1;
}
/* The application never had a pressed look or a focus background: only the mouse hover changes the colors. */
.add:not(:hover) {
  --bs-btn-hover-color: var(--muted);
  --bs-btn-hover-bg: transparent;
  --bs-btn-active-color: var(--muted);
  --bs-btn-active-bg: transparent;
  --bs-btn-disabled-color: var(--muted);
  --bs-btn-disabled-bg: transparent;
}
</style>
