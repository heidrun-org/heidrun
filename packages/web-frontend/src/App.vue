<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import TopBar from "./components/TopBar.vue";
import Sidebar from "./components/Sidebar.vue";
import TabBar from "./components/TabBar.vue";
import PaneGrid from "./components/PaneGrid.vue";
import InputBar from "./components/InputBar.vue";
import RightPanel from "./components/RightPanel.vue";
import NoteModal from "./components/NoteModal.vue";
import Resizer from "./components/Resizer.vue";
import RcModal from "./components/RcModal.vue";
import DangerModal from "./components/DangerModal.vue";
import GitModal from "./components/GitModal.vue";
import { git, merging } from "./stores/git";
import MergeModal from "./components/MergeModal.vue";
import IssueModal from "./components/IssueModal.vue";
import { issueView } from "./stores/issues";
import NewAgentModal from "./components/NewAgentModal.vue";
import { newAgent } from "./stores/agents";
import SearchModal from "./components/SearchModal.vue";
import DockColumn from "./components/DockColumn.vue";
import ShortcutsModal from "./components/ShortcutsModal.vue";
import MosaicModal from "./components/MosaicModal.vue";
import { mosaic } from "./stores/mosaic";
import { activePaneId, dockVisible } from "./stores/dock";
import { search } from "./stores/search";
import { answerDanger, danger } from "./stores/guards";
import StatusBar from "./components/StatusBar.vue";
import CommandPalette from "./components/CommandPalette.vue";
import Offline from "./components/Offline.vue";
import {
  allPanes,
  closePane,
  cycleTab,
  cycleWorkspace,
  newTerminal,
  selectWorkspaceAt,
  selectedPane,
  shiftTab,
  shiftWorkspace,
  splitPane,
  start,
  state,
  toast,
} from "./stores/session";
import { resetZoom, settings, zoom } from "./stores/settings";
import { notes, pinText, selectionReaders } from "./stores/notes";
import { startProjects } from "./stores/project";
import { startGit } from "./stores/git";
import { startAlerts } from "./stores/alerts";
// Records Claude spend by workspace from the start, right panel open or not.
import "./stores/spend";
import { history, loadHistory } from "./stores/history";
import HistoryModal from "./components/HistoryModal.vue";
import MobileModal from "./components/MobileModal.vue";
import FilesModal from "./components/FilesModal.vue";
import { files, openFiles } from "./stores/files";
import { mobile, startMobile } from "./stores/mobile";
import { loadClaudeLink, remote, startRemoteWatch } from "./stores/claude";
import { t } from "./i18n/index";

function codeZoom(dir: 1 | -1) {
  settings.codeFontSize = Math.min(24, Math.max(9, Math.round((settings.codeFontSize + dir) * 2) / 2));
}

// The docked column never squeezes the tab below 420 px, whatever the window size.
const winW = ref(window.innerWidth);
const onResize = () => (winW.value = window.innerWidth);
const sides = computed(() => (settings.leftOpen ? settings.leftWidth : 0) + (settings.rightOpen && state.snapshot ? settings.rightWidth : 0));
const dockShown = computed(() => Math.max(240, Math.min(settings.dockWidth, winW.value - sides.value - 420)));
const dockReserve = computed(() => (dockVisible.value.length ? dockShown.value : 0));

let armedClose: string | null = null;
let armedAt = 0;

// Capture phase: our shortcuts win over xterm, which otherwise swallows the keys.
// e.code is used because ⌥ changes e.key on macOS (⌥B gives "∫").
function onKey(e: KeyboardEvent) {
  if (danger.open) {
    // The confirmation window owns the keyboard: Esc cancels, nothing else runs behind it.
    if (e.key === "Escape") {
      e.preventDefault();
      answerDanger(false);
    } else if (e.metaKey) e.preventDefault();
    return;
  }
  if (!e.metaKey || e.ctrlKey) return;
  // The file explorer (and its editor: ⌘D, ⌘F…) owns the keyboard; only the zoom passes.
  if (files.open && !/^(Equal|Minus|NumpadAdd|NumpadSubtract|Digit0|Numpad0)$/.test(e.code)) return;
  const run = (fn: () => unknown) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
  // ⌥⌘ + arrows: ←/→ tabs, ↑/↓ workspaces.
  // ⇧⌥⌘ + arrows: move the selected tab / workspace.
  if (e.altKey && e.shiftKey) {
    if (e.code === "ArrowLeft") return run(() => shiftTab(-1));
    if (e.code === "ArrowRight") return run(() => shiftTab(1));
    if (e.code === "ArrowUp") return run(() => shiftWorkspace(-1));
    if (e.code === "ArrowDown") return run(() => shiftWorkspace(1));
  }
  if (e.altKey) {
    if (e.code === "ArrowLeft") return run(() => cycleTab(-1));
    if (e.code === "ArrowRight") return run(() => cycleTab(1));
    if (e.code === "ArrowUp") return run(() => cycleWorkspace(-1));
    if (e.code === "ArrowDown") return run(() => cycleWorkspace(1));
  }
  // ⌘/ — and ⌘: on a French keyboard, where "/" needs ⇧. By e.key: the physical
  // "Slash" key is "=" on AZERTY (⌘= zooms).
  if (["/", "?", ":"].includes(e.key)) return run(() => (state.shortcutsOpen = !state.shortcutsOpen));
  // ⌘1 … ⌘9: workspace by position.
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit && !e.altKey && !e.shiftKey) return run(() => selectWorkspaceAt(Number(digit[1]) - 1));

  switch (e.code) {
    case "KeyP":
      // ⌘P: find a file of the selected pane's project (the explorer handles it once open).
      if (!e.shiftKey) {
        if (files.open) return;
        return run(() => openFiles(selectedPane.value?.foreground_cwd || selectedPane.value?.cwd, { search: true }));
      }
      return run(() => {
        const id = activePaneId();
        const pane = allPanes.value.find((p) => p.pane_id === id) ?? selectedPane.value;
        const text = pane ? selectionReaders.get(pane.pane_id)?.() : "";
        if (pane && text) {
          pinText(text, pane);
          settings.rightOpen = true;
          settings.rightTab = "notes";
        } else toast(t("app.selectTextFirst"));
      });
    case "KeyF":
      if (!e.shiftKey) return;
      return run(() => (search.open = !search.open));
    case "KeyH":
      if (!e.shiftKey) return;
      return run(() => (history.open = !history.open));
    case "KeyK":
      return run(() => (state.paletteOpen = !state.paletteOpen));
    case "KeyT":
      return run(() => (e.shiftKey ? (newAgent.open = true) : newTerminal()));
    case "KeyD":
      return run(() => splitPane(e.shiftKey ? "down" : "right"));
    case "KeyW":
      // The file explorer uses ⌘W for its own tabs.
      if (files.open) return;
      // Closing ends the process in the pane: ask for a second ⌘W within 2 s.
      return run(() => {
        const id = activePaneId();
        if (!id) return;
        if (armedClose === id && Date.now() - armedAt < 2000) {
          armedClose = null;
          closePane(id);
        } else {
          armedClose = id;
          armedAt = Date.now();
          toast(t("app.pressAgainToClose"));
        }
      });
    case "KeyB":
      return run(() => {
        if (e.altKey) settings.rightOpen = !settings.rightOpen;
        else settings.leftOpen = !settings.leftOpen;
      });
    // With the Git window open, ⌘+ / ⌘− / ⌘0 size its code, not the terminals.
    case "Equal":
    case "NumpadAdd":
      return run(() => (git.modal.open || issueView.open || files.open ? codeZoom(1) : zoom(0.5)));
    case "Minus":
    case "NumpadSubtract":
      return run(() => (git.modal.open || issueView.open || files.open ? codeZoom(-1) : zoom(-0.5)));
    case "Digit0":
    case "Numpad0":
      return run(() => (git.modal.open || issueView.open || files.open ? (settings.codeFontSize = 12.5) : resetZoom()));
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", onResize);
  start();
  startProjects();
  startGit();
  startAlerts();
  loadHistory();
  startMobile();
  loadClaudeLink();
  startRemoteWatch();
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey, true);
  window.removeEventListener("resize", onResize);
});
</script>

<template>
  <div class="app">
    <TopBar />
    <div class="body">
      <template v-if="settings.leftOpen">
        <Sidebar />
        <Resizer v-model:width="settings.leftWidth" side="left" :min="200" :max="520" :default-width="280" :reserve="(settings.rightOpen ? settings.rightWidth : 0) + dockReserve" />
      </template>
      <main class="center">
        <template v-if="state.snapshot">
          <TabBar />
          <div class="stage">
            <PaneGrid />
            <template v-if="dockVisible.length">
              <Resizer
                :width="dockShown"
                @update:width="(v: number) => (settings.dockWidth = v)"
                side="right"
                :min="320"
                :max="1400"
                :default-width="560"
                :reserve="(settings.leftOpen ? settings.leftWidth : 0) + (settings.rightOpen ? settings.rightWidth : 0)"
              />
              <DockColumn :style="{ width: `${dockShown}px` }" />
            </template>
          </div>
          <InputBar />
        </template>
        <Offline v-else />
      </main>
      <template v-if="state.snapshot && settings.rightOpen">
        <Resizer v-model:width="settings.rightWidth" side="right" :min="260" :max="720" :default-width="320" :reserve="(settings.leftOpen ? settings.leftWidth : 0) + dockReserve" />
        <RightPanel />
      </template>
    </div>
    <StatusBar />
    <CommandPalette v-if="state.paletteOpen" />
    <NoteModal v-if="notes.openId" />
    <RcModal v-if="remote.openFor" />
    <GitModal v-if="git.modal.open" />
    <MergeModal v-if="merging.open && merging.req" />
    <IssueModal v-if="issueView.open" />
    <NewAgentModal v-if="newAgent.open" />
    <SearchModal v-if="search.open" />
    <ShortcutsModal v-if="state.shortcutsOpen" />
    <MosaicModal v-if="mosaic.paneId" />
    <HistoryModal v-if="history.open" />
    <MobileModal v-if="mobile.open" />
    <FilesModal v-if="files.open" />
    <DangerModal v-if="danger.open" />
    <Transition name="toast">
      <div v-if="state.toast" class="toast" role="status">{{ state.toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.app { height: 100%; display: flex; flex-direction: column; }
.body { flex: 1; min-height: 0; display: flex; }
.center { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.stage { flex: 1; min-height: 0; display: flex; }
.stage > :first-child { flex: 1; min-width: 0; }
.toast {
  position: fixed; left: 50%; bottom: 52px; transform: translateX(-50%);
  padding: 10px 16px; border-radius: 10px; background: #23272c; border: 1px solid var(--line-strong);
  color: var(--text); font-size: 12.5px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5); z-index: 50;
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 6px); }
</style>
