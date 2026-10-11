<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import { allPanes, closeTab, finishRename, moveTab, selectTab, startRename, state, tabLabel, tabs } from "../stores/session";
import { remote } from "../stores/claude";
import { useReorder } from "../lib/reorder";
import { onNewPaneClick } from "../stores/newPane";
import { t } from "../i18n/index";

/** The place of the open menu of a tab: the tab and the corner of its menu button, in pixels of the window. */
type TabMenu = { tabId: string; top: number; right: number };

/** The menu of a tab that is open, or null. It is drawn once, outside the row of tabs, so that the row can scroll. */
const tabMenu = ref<TabMenu | null>(null);

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

function openTabMenu(event: MouseEvent, tabId: string) {
  if (tabMenu.value?.tabId === tabId) {
    tabMenu.value = null;
    return;
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  tabMenu.value = { tabId, top: rect.bottom + 2, right: window.innerWidth - rect.right };
}

function renameFromMenu(tabId: string) {
  tabMenu.value = null;
  startRename("tab", tabId);
}

function closeMenu() {
  tabMenu.value = null;
}

onMounted(() => document.addEventListener("mousedown", closeMenu));
onBeforeUnmount(() => document.removeEventListener("mousedown", closeMenu));
</script>

<template>
  <div class="tab-bar d-flex align-items-center">
    <div class="tab-row d-flex align-items-center" role="tablist" :aria-label="t('tabBar.label')">
      <template v-for="(tab, tabIndex) in tabs" :key="tab.tab_id">
        <div v-if="state.renaming === `tab:${tab.tab_id}`" class="tab editing" role="presentation">
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
          class="tab"
          role="presentation"
          :class="{
            active: tab.tab_id === state.selectedTabId,
            menuOpen: tabMenu?.tabId === tab.tab_id,
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
            class="tab-main"
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
          <span class="tab-actions">
            <button
              class="tab-action"
              :aria-label="t('tabBar.menuLabel', { name: tabLabel(tab.tab_id) })"
              :title="t('tabBar.menu')"
              aria-haspopup="menu"
              :aria-expanded="tabMenu?.tabId === tab.tab_id"
              @mousedown.stop
              @click.stop="openTabMenu($event, tab.tab_id)"
            ><Icon name="three-dots-vertical" /></button>
            <ConfirmButton
              icon="x-lg"
              :confirm-label="t('tabBar.closeConfirm')"
              :question="t('tabBar.close', { name: tabLabel(tab.tab_id) })"
              @confirm="closeTab(tab.tab_id)"
            />
          </span>
        </div>
      </template>
    </div>
    <button
      class="btn border-0 justify-content-center add"
      :title="t('tabBar.newTabTitle')"
      :aria-label="t('tabBar.newTabTitle')"
      @click="onNewPaneClick"
    ><Icon name="plus-lg" /></button>
    <div v-if="tabMenu !== null" class="tab-menu" role="menu" :style="{ top: `${tabMenu.top}px`, right: `${tabMenu.right}px` }" @mousedown.stop>
      <button class="tab-menu-item" role="menuitem" @click.stop="renameFromMenu(tabMenu.tabId)">{{ t("tabBar.rename") }}</button>
    </div>
  </div>
</template>

<style scoped>
.tab-bar { flex-shrink: 0; gap: 4px; min-width: 0; padding: 4px 0; }
.tab-row { flex: 0 1 auto; min-width: 0; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.tab {
  --tab-background: transparent;
  position: relative; flex: 0 1 200px; min-width: 120px; height: 32px; display: flex; align-items: center; gap: 8px;
  padding: 0 8px 0 10px; border-radius: 8px; background: var(--tab-background); color: var(--muted); font-weight: 500;
}
.tab:hover { --tab-background: var(--overlay-hover); color: var(--text-2); }
/* The selected tab has the color of the panes below it, which is far from the color of the bar. */
.tab.active { --tab-background: var(--bg); color: var(--text); font-weight: 600; box-shadow: inset 0 0 0 1px var(--line-strong); }
.tab.editing { --tab-background: var(--bg); padding-right: 4px; box-shadow: inset 0 0 0 1px var(--line-strong); }
.tab.dragging { opacity: 0.4; }
.tab.drop-before::before, .tab.drop-after::after {
  content: ""; position: absolute; top: 4px; bottom: 4px; width: 2px; border-radius: 1px; background: var(--done);
}
.tab.drop-before::before { left: -2px; }
.tab.drop-after::after { right: -2px; }
.tab-main {
  flex: 1; min-width: 0; height: 100%; display: flex; align-items: center; gap: 8px; padding: 0;
  border: none; background: transparent; color: inherit; font: inherit; text-align: left;
}
.tab-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc {
  font: 600 var(--font-size) var(--mono); letter-spacing: 0.4px; padding: 1px 5px; border-radius: 4px;
  background: var(--tint-working); color: var(--working);
}
/* The actions of a tab cover the end of its name, so that a tab keeps its width when the mouse moves over it. */
.tab-actions {
  position: absolute; top: 0; bottom: 0; right: 0; display: none; align-items: center; padding: 0 3px 0 8px;
  border-radius: 0 8px 8px 0; background: linear-gradient(to right, transparent, var(--tab-background) 8px);
}
.tab:hover .tab-actions, .tab.menuOpen .tab-actions, .tab:focus-within .tab-actions { display: flex; }
.tab-action, .tab-actions .confirm {
  width: 16px; min-width: 16px; height: 16px; padding: 0; border: none; border-radius: 4px; background: transparent;
  color: var(--muted); display: inline-flex; align-items: center; justify-content: center; font-size: calc(var(--font-size) * 0.75);
}
.tab-action:hover, .tab-actions .confirm:hover { background: var(--overlay-hover); color: var(--text); }
.tab-menu {
  position: fixed; z-index: 20; min-width: 120px; padding: 4px; border-radius: 8px;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.tab-menu-item {
  width: 100%; height: 28px; padding: 0 10px; border: none; border-radius: 6px; background: transparent;
  color: var(--text-2); text-align: left; font-size: var(--font-size);
}
.tab-menu-item:hover { background: var(--hover); color: var(--text); }
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
