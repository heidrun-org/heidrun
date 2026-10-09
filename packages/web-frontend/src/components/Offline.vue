<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as api from "../lib/api";
import { refresh, startHerdr, state } from "../stores/session";
import { settings } from "../stores/settings";

const paths = ref<Awaited<ReturnType<typeof api.paths>> | null>(null);
onMounted(async () => {
  try {
    paths.value = await api.paths();
  } catch {
    /* ignore */
  }
});
</script>

<template>
  <div class="offline">
    <div class="card">
      <div class="eyebrow">Connexion</div>
      <h1>{{ state.starting ? "Démarrage de Herdr…" : "Herdr ne répond pas" }}</h1>
      <p>
        Herdr Desk peut démarrer le serveur Herdr en arrière-plan, sans terminal. Il continue de tourner
        quand tu fermes l’app, jusqu’à <span class="mono">herdr server stop</span> ou au redémarrage du Mac.
      </p>
      <div class="row">
        <button title="Start Herdr" class="btn lg primary" :disabled="state.starting" @click="startHerdr()">Démarrer Herdr</button>
        <button title="Try to connect again" class="btn lg" :disabled="state.starting" @click="refresh()">Réessayer</button>
      </div>
      <label class="check"><input v-model="settings.autoStartHerdr" type="checkbox" />Démarrer Herdr automatiquement à l’ouverture de l’app</label>
      <dl v-if="paths">
        <dt>Socket</dt>
        <dd class="mono">{{ paths.socket }} <span :class="paths.socket_exists ? 'ok' : 'ko'">{{ paths.socket_exists ? "trouvé" : "absent" }}</span></dd>
        <dt>Binaire</dt>
        <dd class="mono">{{ paths.bin }} <span :class="paths.bin_exists ? 'ok' : 'ko'">{{ paths.bin_exists ? "trouvé" : "absent" }}</span></dd>
      </dl>
      <p v-if="state.error" class="err mono">{{ state.error }}</p>
    </div>
  </div>
</template>

<style scoped>
.offline { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; }
.card { width: min(520px, 100%); display: flex; flex-direction: column; gap: 12px; user-select: text; }
h1 { margin: 0; font-size: 22px; font-weight: 600; }
p { margin: 0; color: var(--text-2); }
pre { margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--field); color: var(--text); }
dl { display: grid; grid-template-columns: 70px 1fr; gap: 6px 12px; margin: 4px 0; font-size: 12px; }
dt { color: var(--muted); }
dd { margin: 0; word-break: break-all; }
.ok { color: var(--working); }
.ko { color: var(--fail); }
.err { color: var(--fail); font-size: 12px; }
.row { display: flex; gap: 8px; }
.row .btn { padding: 0 20px; }
.btn:disabled { opacity: 0.5; }
.check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); }
.check input { accent-color: var(--done); }
</style>
