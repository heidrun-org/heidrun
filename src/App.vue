<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import TopBar from "./components/TopBar.vue";
import Sidebar from "./components/Sidebar.vue";
import TabBar from "./components/TabBar.vue";
import PaneGrid from "./components/PaneGrid.vue";
import InputBar from "./components/InputBar.vue";
import RightPanel from "./components/RightPanel.vue";
import NoteModal from "./components/NoteModal.vue";
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
import { loadClaudeLink } from "./stores/claude";

let armedClose: string | null = null;
let armedAt = 0;

// Capture phase: our shortcuts win over xterm, which otherwise swallows the keys.
// e.code is used because ⌥ changes e.key on macOS (⌥B gives "∫").
function onKey(e: KeyboardEvent) {
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
    case "Equal":
    case "NumpadAdd":
      return run(() => zoom(0.5));
    case "Minus":
    case "NumpadSubtract":
      return run(() => zoom(-0.5));
    case "Digit0":
    case "Numpad0":
      return run(() => resetZoom());
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  start();
  startProjects();
  loadClaudeLink();
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="app">
    <TopBar />
    <div class="body">
      <Sidebar v-if="settings.leftOpen" />
      <main class="center">
        <template v-if="state.snapshot">
          <TabBar />
          <PaneGrid />
          <InputBar />
        </template>
        <Offline v-else />
      </main>
      <RightPanel v-if="state.snapshot && settings.rightOpen" />
    </div>
    <StatusBar />
    <CommandPalette v-if="state.paletteOpen" />
    <NoteModal v-if="notes.openId" />
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
