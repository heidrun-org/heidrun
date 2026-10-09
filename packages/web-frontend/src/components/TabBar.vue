<script setup lang="ts">
import ConfirmButton from "./ConfirmButton.vue";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import { useReorder } from "../lib/reorder";
import { t } from "../i18n/index";
import { closeTab, finishRename, moveTab, newTerminal, selectTab, splitPane, startRename, state, tabs } from "../stores/session";

const tr = useReorder("x", (id, at) => moveTab(id, at));
</script>

<template>
  <!-- Also accepts drops in the small gaps between tabs (last marker shown wins). -->
  <div
    class="tabs"
    @dragover="tr.dragging.value && $event.preventDefault()"
    @drop="tr.onDrop($event, tabs.map((x) => x.tab_id))"
  >
    <div
      v-for="(tab, ti) in tabs"
      :key="tab.tab_id"
      class="tab"
      :class="{
        active: tab.tab_id === state.selectedTabId,
        dragging: tr.dragging.value === tab.tab_id,
        'drop-before': tr.gap.value === ti,
        'drop-after': tr.gap.value === ti + 1 && ti === tabs.length - 1,
      }"
      :draggable="state.renaming !== `tab:${tab.tab_id}`"
      @dragstart="tr.onDragStart($event, tab.tab_id)"
      @dragover="tr.onDragOver($event, ti)"
      @drop="tr.onDrop($event, tabs.map((x) => x.tab_id))"
      @dragend="tr.onDragEnd()"
    >
      <InlineRename
        v-if="state.renaming === `tab:${tab.tab_id}`"
        class="tab-rename"
        :value="tab.label"
        :label="t('tabBar.renameLabel')"
        @save="(v) => finishRename('tab', tab.tab_id, v)"
        @cancel="state.renaming = null"
      />
      <button
        v-else
        class="tab-main"
        :title="t('tabBar.tabTitle')"
        @click="selectTab(tab.tab_id)"
        @dblclick="startRename('tab', tab.tab_id)"
      >
        <span v-if="tab.agent_status !== 'idle'" class="dot" :class="tab.agent_status"></span>
        {{ tab.label || t("tabBar.tabNumber", { number: tab.number }) }}
      </button>
      <ConfirmButton
        class="tab-close"
        icon="x-lg"
        :confirm-label="t('tabBar.closeConfirm')"
        :question="t('tabBar.closeTab', { name: tab.label || tab.number, count: tab.pane_count })"
        @confirm="closeTab(tab.tab_id)"
      />
    </div>
    <button class="tab-add" :aria-label="t('tabBar.newTab')" :title="t('tabBar.newTabTitle')" @click="newTerminal()"><Icon name="plus-lg" /></button>
    <div class="spacer"></div>
    <button class="btn" :title="t('tabBar.splitRight')" @click="splitPane('right')"><Icon name="layout-split" /> <kbd>⌘D</kbd></button>
    <button class="btn" :title="t('tabBar.splitDown')" @click="splitPane('down')"><Icon name="layout-split" class="rotated" /> <kbd>⇧⌘D</kbd></button>
  </div>
</template>

<style scoped>
.tabs {
  height: 44px; flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 0 16px;
  border-bottom: 1px solid var(--line); overflow-x: auto;
}
.tab { position: relative; display: flex; align-items: center; border-radius: 7px; color: var(--muted-2); }
.tab.dragging { opacity: 0.4; }
.tab.drop-before::before, .tab.drop-after::after {
  content: ""; position: absolute; top: 4px; bottom: 4px; width: 2px; border-radius: 1px; background: var(--done);
}
.tab.drop-before::before { left: -3px; }
.tab.drop-after::after { right: -3px; }
.tab:hover { color: var(--text-2); background: var(--hover-soft); }
.tab.active { background: var(--hover); color: var(--text); }
.tab-main {
  height: 30px; padding: 0 4px 0 12px; border: none; background: transparent; color: inherit;
  font-weight: 500; display: flex; align-items: center; gap: 8px; white-space: nowrap;
}
.tab-rename { width: 140px; margin: 0 4px; }
.tab-close { margin-right: 4px; opacity: 0; }
.tab:hover .tab-close, .tab.active .tab-close, .tab-close.armed, .tab-close:focus-visible { opacity: 1; }
.tab-add {
  width: 30px; height: 30px; border: none; border-radius: 7px; background: transparent;
  color: var(--muted-2); font-size: 16px;
}
.tab-add:hover { background: var(--hover); color: var(--text); }
.spacer { flex: 1; }
.btn + .btn { margin-left: 4px; }
</style>
