<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import * as api from "../lib/api";
import { refresh, startHerdr, state } from "../stores/session";
import { settings } from "../stores/settings";
import { t } from "../i18n/index";

const paths = ref<Awaited<ReturnType<typeof api.paths>> | null>(null);
onMounted(async () => {
  try {
    paths.value = await api.paths();
  } catch {
    /* ignore */
  }
});
// The command is shown in a monospace font in the middle of the sentence.
const introParts = computed(() => t("offline.intro").split("{command}"));
</script>

<template>
  <div class="offline">
    <div class="card">
      <div class="eyebrow">{{ t("offline.connection") }}</div>
      <h1>{{ state.starting ? t("offline.starting") : t("offline.notResponding") }}</h1>
      <p>
        {{ introParts[0] }}<span class="mono">herdr server stop</span>{{ introParts[1] }}
      </p>
      <div class="row">
        <button :title="t('offline.startTitle')" class="btn lg primary" :disabled="state.starting" @click="startHerdr()">{{ t("offline.start") }}</button>
        <button :title="t('offline.retryTitle')" class="btn lg" :disabled="state.starting" @click="refresh()">{{ t("offline.retry") }}</button>
      </div>
      <label class="check"><input v-model="settings.autoStartHerdr" type="checkbox" />{{ t("offline.autoStart") }}</label>
      <dl v-if="paths">
        <dt>{{ t("offline.socket") }}</dt>
        <dd class="mono">{{ paths.socket }} <span :class="paths.socket_exists ? 'ok' : 'ko'">{{ paths.socket_exists ? t("offline.found") : t("offline.missing") }}</span></dd>
        <dt>{{ t("offline.binary") }}</dt>
        <dd class="mono">{{ paths.bin }} <span :class="paths.bin_exists ? 'ok' : 'ko'">{{ paths.bin_exists ? t("offline.found") : t("offline.missing") }}</span></dd>
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
