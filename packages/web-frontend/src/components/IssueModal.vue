<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import { issueView } from "../stores/issues";
import { settings } from "../stores/settings";
import { renderMarkdown } from "../lib/markdown";
import { ago } from "../lib/format";

const el = ref<HTMLElement>();
const d = computed(() => issueView.data);
const mdCtx = computed(() => {
  if (!d.value) return undefined;
  let host = "";
  try {
    host = new URL(d.value.project).hostname;
  } catch {
    /* no project page */
  }
  // Images load only from the forge itself (and GitHub's attachment hosts).
  const imgHosts = [host, ...(d.value.forge === "GitHub" ? ["user-images.githubusercontent.com", "private-user-images.githubusercontent.com", "avatars.githubusercontent.com"] : [])].filter(Boolean);
  return { project: d.value.project, imgHosts };
});
const body = computed(() => (d.value?.body ? renderMarkdown(d.value.body, mdCtx.value) : ""));
const comments = computed(() => (d.value?.comments ?? []).map((c) => ({ ...c, html: renderMarkdown(c.body, mdCtx.value) })));
const webUrl = computed(() => issueView.url ?? d.value?.url ?? null);
const forgeName = computed(() => d.value?.forge ?? (issueView.url?.includes("github") ? "GitHub" : "GitLab"));

function close() {
  issueView.open = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}
// Links of the description open in the browser, never inside the app.
function onClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute("href") ?? "";
  if (/^https?:\/\//.test(href)) openUrl(href).catch(() => {});
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  nextTick(() => el.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <div ref="el" class="modal" role="dialog" aria-label="Aperçu" tabindex="-1">
      <header class="top">
        <div class="title">
          <span class="mono ref">{{ d?.ref ?? "…" }}</span>
          <span v-if="d" class="chip" :class="d.stateLevel">{{ d.state }}</span>
          <span v-for="l in d?.labels ?? []" :key="l" class="label">{{ l }}</span>
        </div>
        <div class="tools">
          <div class="seg" role="radiogroup" aria-label="Largeur de lecture">
            <button :class="{ on: settings.mdWidth === 'center' }" @click="settings.mdWidth = 'center'">Centré</button>
            <button :class="{ on: settings.mdWidth === 'full' }" @click="settings.mdWidth = 'full'">Pleine largeur</button>
          </div>
          <button v-if="webUrl" class="btn" @click="openUrl(webUrl!)">Ouvrir sur {{ forgeName }} <Icon name="box-arrow-up-right" /></button>
          <button class="close" aria-label="Fermer (Échap)" @click="close"><Icon name="x-lg" /></button>
        </div>
      </header>

      <div class="scroll" :style="{ fontSize: `${settings.codeFontSize + 2.5}px` }" @click="onClick" @auxclick="onClick">
        <div v-if="issueView.loading" class="empty">Chargement…</div>
        <div v-else-if="issueView.error" class="empty err">{{ issueView.error }}</div>
        <template v-else-if="d">
          <div class="md-doc head-doc" :class="{ full: settings.mdWidth === 'full' }">
            <h1 class="t">{{ d.title }}</h1>
            <p class="meta">
              <span v-if="d.author">{{ d.author }}</span>
              <span v-if="d.at"> · {{ ago(d.at) }}</span>
              <span v-if="d.branches" class="mono"> · {{ d.branches }}</span>
            </p>
          </div>
          <article v-if="body" class="md-doc" :class="{ full: settings.mdWidth === 'full' }" v-html="body"></article>
          <div v-else class="md-doc muted" :class="{ full: settings.mdWidth === 'full' }">Pas de description.</div>

          <section v-if="comments.length" class="md-doc comments" :class="{ full: settings.mdWidth === 'full' }">
            <h2>Commentaires <span class="count">{{ comments.length }}</span></h2>
            <div v-for="(c, i) in comments" :key="i" class="comment">
              <div class="c-head"><strong>{{ c.author }}</strong><span v-if="c.at" class="muted"> · {{ ago(c.at) }}</span></div>
              <div class="c-body" v-html="c.html"></div>
            </div>
          </section>
        </template>
      </div>
      <footer class="foot muted">Échap pour fermer · ⌘+ / ⌘− taille du texte</footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 55; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; }
.modal {
  outline: none; width: 94vw; height: 90vh; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden;
  background: var(--panel); border: 1px solid #33383e; box-shadow: 0 24px 72px rgba(0, 0, 0, 0.6);
}
.top { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.title { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
.ref { color: #c29bf0; font-size: 13px; }
.label { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #1f2730; color: var(--text-2); }
.chip { height: 22px; padding: 0 8px; border-radius: 11px; display: inline-flex; align-items: center; font-size: 11px; font-weight: 600; background: #1d2024; color: var(--text-2); }
.chip.ok { background: #132a1c; color: var(--ok); } .chip.merged { background: #24193a; color: #c29bf0; }
.chip.crit { background: #301817; color: var(--blocked); } .chip.muted { color: var(--muted); }
.tools { display: flex; align-items: center; gap: 8px; }
.seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--bg); gap: 2px; }
.seg button { border: none; background: transparent; color: var(--muted); font-size: 12px; padding: 4px 10px; border-radius: 6px; }
.seg button.on { background: var(--hover); color: var(--text); }
.close { width: 30px; height: 30px; border: none; border-radius: 8px; background: transparent; color: var(--muted); font-size: 20px; }
.close:hover { background: var(--hover); color: var(--text); }
.scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 40px 60px; }
.scroll .md-doc { font-size: inherit; }
.head-doc .t { border: none; margin-bottom: 0.2em; }
.meta { color: var(--muted); font-size: 0.85em; }
.comments { margin-top: 2em; }
.count { color: var(--muted); font-weight: 400; font-size: 0.8em; }
.comment { border: 1px solid var(--line-strong); border-radius: 10px; padding: 10px 16px; margin-bottom: 12px; background: rgba(255, 255, 255, 0.02); }
.c-head { font-size: 0.85em; margin-bottom: 4px; }
.c-body :deep(p:last-child) { margin-bottom: 0; }
.empty { padding: 24px; color: var(--muted); }
.err { color: var(--fail); }
.muted { color: var(--muted); }
.foot { flex-shrink: 0; padding: 6px 16px; border-top: 1px solid var(--line); font-size: 11px; }
</style>
