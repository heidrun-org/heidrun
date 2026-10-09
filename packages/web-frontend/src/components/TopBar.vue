<script setup lang="ts">
import FontMenu from "./FontMenu.vue";
import Icon from "./Icon.vue";
import { counts, state } from "../stores/session";
import { settings } from "../stores/settings";
import { mobile } from "../stores/mobile";
</script>

<template>
  <!-- macOS traffic lights sit over the left padding (titleBarStyle: Overlay). -->
  <header class="top" data-tauri-drag-region>
    <button
      class="icon-btn"
      :class="{ on: settings.leftOpen }"
      :aria-pressed="settings.leftOpen"
      aria-label="Afficher la barre latérale gauche"
      title="Barre latérale gauche (⌘B)"
      @click="settings.leftOpen = !settings.leftOpen"
    >
      <Icon name="layout-sidebar" />
    </button>
    <div class="brand" data-tauri-drag-region>Herdr Desk</div>
    <div class="machine" :title="state.error || 'Connecté au serveur Herdr local'">
      <span class="dot" :class="state.connected ? 'working-static' : 'offline'"></span>
      Local · {{ state.snapshot ? `Herdr ${state.snapshot.version}` : "hors ligne" }}
    </div>
    <div class="search-wrap" data-tauri-drag-region>
      <button title="Search or run a command" class="search" @click="state.paletteOpen = true">
        <span>Rechercher, lancer une commande…</span><kbd>⌘K</kbd>
      </button>
    </div>
    <div class="counts">
      <span><span class="dot blocked"></span>{{ counts.blocked }} bloqué{{ counts.blocked > 1 ? "s" : "" }}</span>
      <span><span class="dot working"></span>{{ counts.working }} en cours</span>
      <span><span class="dot done"></span>{{ counts.done }} terminé{{ counts.done > 1 ? "s" : "" }}</span>
    </div>
    <button
      class="icon-btn help"
      :class="{ on: mobile.status?.enabled }"
      aria-label="Accès mobile"
      :title="mobile.status?.enabled ? (mobile.status.running ? 'Accès mobile actif' : 'Accès mobile : erreur') : 'Accès mobile (iPhone, iPad)'"
      @click="mobile.open = true"
    >
      <Icon name="phone" />
    </button>
    <button class="icon-btn help" aria-label="Raccourcis" title="Raccourcis (⌘/)" @click="state.shortcutsOpen = true">?</button>
    <FontMenu />
    <button
      class="icon-btn"
      :class="{ on: settings.rightOpen }"
      :aria-pressed="settings.rightOpen"
      aria-label="Afficher le panneau de droite"
      title="Panneau de droite (⌥⌘B)"
      @click="settings.rightOpen = !settings.rightOpen"
    >
      <Icon name="layout-sidebar-reverse" />
    </button>
  </header>
</template>

<style scoped>
.top {
  height: 48px; flex-shrink: 0; display: flex; align-items: center; gap: 12px;
  padding: 0 16px 0 84px; border-bottom: 1px solid var(--line); background: var(--bar);
}
.brand { font-weight: 600; font-size: 14px; letter-spacing: 0.2px; white-space: nowrap; }
.machine {
  display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 8px; white-space: nowrap;
  border: 1px solid var(--line-strong); background: var(--field); color: var(--text-2); font-size: 12px; font-weight: 500;
}
.working-static { background: var(--working); }
.offline { background: var(--fail); }
.search-wrap { flex: 1; display: flex; justify-content: center; min-width: 120px; }
.search {
  width: min(420px, 100%); height: 30px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--muted); font-size: 12px; overflow: hidden; white-space: nowrap;
}
.search kbd { font-family: var(--mono); color: var(--faint); }
.counts { display: flex; gap: 12px; font-size: 12px; color: #9aa0a6; white-space: nowrap; }
.counts > span { display: flex; align-items: center; gap: 6px; }
.icon-btn {
  width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; border: 1px solid var(--line-strong);
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.icon-btn:hover { background: var(--hover); color: var(--text); }
.icon-btn.help { font-size: 13px; font-weight: 600; }
.icon-btn.on { color: var(--text-2); background: var(--field); }
@media (max-width: 1180px) { .counts { display: none; } }
</style>
