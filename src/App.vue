<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import TopBar from "./components/TopBar.vue";
import Sidebar from "./components/Sidebar.vue";
import TabBar from "./components/TabBar.vue";
import PaneGrid from "./components/PaneGrid.vue";
import InputBar from "./components/InputBar.vue";
import Inspector from "./components/Inspector.vue";
import StatusBar from "./components/StatusBar.vue";
import CommandPalette from "./components/CommandPalette.vue";
import Offline from "./components/Offline.vue";
import { newTerminal, splitPane, start, state } from "./stores/session";

// Capture phase: our shortcuts win over xterm, which otherwise swallows the keys.
function onKey(e: KeyboardEvent) {
  if (!e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  let handled = true;
  if (k === "k") state.paletteOpen = !state.paletteOpen;
  else if (k === "t") newTerminal();
  else if (k === "d") splitPane(e.shiftKey ? "down" : "right");
  else handled = false;
  if (handled) {
    e.preventDefault();
    e.stopPropagation();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  start();
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="app">
    <TopBar />
    <div class="body">
      <Sidebar />
      <main class="center">
        <template v-if="state.snapshot">
          <TabBar />
          <PaneGrid />
          <InputBar />
        </template>
        <Offline v-else />
      </main>
      <Inspector v-if="state.snapshot" />
    </div>
    <StatusBar />
    <CommandPalette v-if="state.paletteOpen" />
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
