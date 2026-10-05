<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as api from "../lib/api";
import { refresh, state } from "../stores/session";

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
      <h1>Herdr ne répond pas</h1>
      <p>Herdr Desk se connecte au serveur Herdr local. Lance-le une fois dans un terminal :</p>
      <pre class="mono">herdr</pre>
      <p>Tu peux ensuite te détacher (<span class="mono">ctrl+b</span> puis <span class="mono">q</span>) : le serveur reste actif.</p>
      <dl v-if="paths">
        <dt>Socket</dt>
        <dd class="mono">{{ paths.socket }} <span :class="paths.socket_exists ? 'ok' : 'ko'">{{ paths.socket_exists ? "trouvé" : "absent" }}</span></dd>
        <dt>Binaire</dt>
        <dd class="mono">{{ paths.bin }} <span :class="paths.bin_exists ? 'ok' : 'ko'">{{ paths.bin_exists ? "trouvé" : "absent" }}</span></dd>
      </dl>
      <p v-if="state.error" class="err mono">{{ state.error }}</p>
      <button class="btn lg primary" @click="refresh()">Réessayer</button>
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
.btn { align-self: flex-start; padding: 0 20px; }
</style>
