<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
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
import { answerDanger, danger } from "./stores/guards";
import StatusBar from "./components/StatusBar.vue";
import CommandPalette from "./components/CommandPalette.vue";
import Offline from "./components/Offline.vue";
import {
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
import { loadClaudeLink, remote, startRemoteWatch } from "./stores/claude";

function codeZoom(dir: 1 | -1) {
  settings.codeFontSize = Math.min(24, Math.max(9, Math.round((settings.codeFontSize + dir) * 2) / 2));
}

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
  // ⌘1 … ⌘9: workspace by position.
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit && !e.altKey && !e.shiftKey) return run(() => selectWorkspaceAt(Number(digit[1]) - 1));

  switch (e.code) {
    case "KeyP":
      if (!e.shiftKey) return;
      return run(() => {
        const pane = selectedPane.value;
        const text = pane ? selectionReaders.get(pane.pane_id)?.() : "";
        if (pane && text) {
          pinText(text, pane);
          settings.rightOpen = true;
          settings.rightTab = "notes";
        } else toast("Sélectionne d’abord du texte dans un terminal");
      });
    case "KeyK":
      return run(() => (state.paletteOpen = !state.paletteOpen));
    case "KeyT":
      return run(() => newTerminal());
    case "KeyD":
      return run(() => splitPane(e.shiftKey ? "down" : "right"));
    case "KeyW":
      // Closing ends the process in the pane: ask for a second ⌘W within 2 s.
      return run(() => {
        const id = state.selectedPaneId;
        if (!id) return;
        if (armedClose === id && Date.now() - armedAt < 2000) {
          armedClose = null;
          closePane(id);
        } else {
          armedClose = id;
          armedAt = Date.now();
          toast("⌘W encore une fois pour fermer ce panneau");
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
      return run(() => (git.modal.open ? codeZoom(1) : zoom(0.5)));
    case "Minus":
    case "NumpadSubtract":
      return run(() => (git.modal.open ? codeZoom(-1) : zoom(-0.5)));
    case "Digit0":
    case "Numpad0":
      return run(() => (git.modal.open ? (settings.codeFontSize = 12.5) : resetZoom()));
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  start();
  startProjects();
  startGit();
  startAlerts();
  loadClaudeLink();
  startRemoteWatch();
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="app">
    <TopBar />
    <div class="body">
      <template v-if="settings.leftOpen">
        <Sidebar />
        <Resizer v-model:width="settings.leftWidth" side="left" :min="200" :max="520" :default-width="280" :reserve="settings.rightOpen ? settings.rightWidth : 0" />
      </template>
      <main class="center">
        <template v-if="state.snapshot">
          <TabBar />
          <PaneGrid />
          <InputBar />
        </template>
        <Offline v-else />
      </main>
      <template v-if="state.snapshot && settings.rightOpen">
        <Resizer v-model:width="settings.rightWidth" side="right" :min="260" :max="720" :default-width="320" :reserve="settings.leftOpen ? settings.leftWidth : 0" />
        <RightPanel />
      </template>
    </div>
    <StatusBar />
    <CommandPalette v-if="state.paletteOpen" />
    <NoteModal v-if="notes.openId" />
    <RcModal v-if="remote.openFor" />
    <GitModal v-if="git.modal.open" />
    <MergeModal v-if="merging.open && merging.req" />
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
.toast {
  position: fixed; left: 50%; bottom: 52px; transform: translateX(-50%);
  padding: 10px 16px; border-radius: 10px; background: #23272c; border: 1px solid var(--line-strong);
  color: var(--text); font-size: 12.5px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5); z-index: 50;
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 6px); }
</style>
