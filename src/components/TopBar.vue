<script setup lang="ts">
import { counts, state } from "../stores/session";
</script>

<template>
  <!-- macOS traffic lights sit over the left padding (titleBarStyle: Overlay). -->
  <header class="top" data-tauri-drag-region>
    <div class="brand" data-tauri-drag-region>Herdr Desk</div>
    <div class="machine" :title="state.error || 'Connecté au serveur Herdr local'">
      <span class="dot" :class="state.connected ? 'working-static' : 'offline'"></span>
      Local · {{ state.snapshot ? `Herdr ${state.snapshot.version}` : "hors ligne" }}
    </div>
    <div class="search-wrap" data-tauri-drag-region>
      <button class="search" @click="state.paletteOpen = true">
        <span>Rechercher, lancer une commande…</span><kbd>⌘K</kbd>
      </button>
    </div>
    <div class="counts">
      <span><span class="dot blocked"></span>{{ counts.blocked }} bloqué{{ counts.blocked > 1 ? "s" : "" }}</span>
      <span><span class="dot working"></span>{{ counts.working }} en cours</span>
      <span><span class="dot done"></span>{{ counts.done }} terminé{{ counts.done > 1 ? "s" : "" }}</span>
    </div>
  </header>
</template>

<style scoped>
.top {
  height: 48px; flex-shrink: 0; display: flex; align-items: center; gap: 16px;
  padding: 0 16px 0 88px; border-bottom: 1px solid var(--line); background: var(--bar);
}
.brand { font-weight: 600; font-size: 14px; letter-spacing: 0.2px; }
.machine {
  display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 8px;
  border: 1px solid var(--line-strong); background: var(--field); color: var(--text-2); font-size: 12px; font-weight: 500;
}
.working-static { background: var(--working); }
.offline { background: var(--fail); }
.search-wrap { flex: 1; display: flex; justify-content: center; }
.search {
  width: min(420px, 100%); height: 30px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--muted); font-size: 12px;
}
.search kbd { font-family: var(--mono); color: var(--faint); }
.counts { display: flex; gap: 12px; font-size: 12px; color: #9aa0a6; }
.counts > span { display: flex; align-items: center; gap: 6px; }
</style>
