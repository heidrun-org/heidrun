// Git state per workspace, and merge requests / pull requests from GitLab or GitHub.
import { computed, reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { allPanes, selectedPane, state as session, workspaces } from "./session";
import { refContext, type Forge } from "../lib/refs";

export interface GitStatus {
  root: string;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  changed: number;
  untracked: number;
  files: { status: string; path: string }[];
  last_sha: string | null;
  last_subject: string | null;
  last_time: number | null;
  remote: string | null;
}

export type Level = "ok" | "warn" | "crit" | "pending" | "muted";

export interface Request {
  ref: string; // "!12" or "#12"
  title: string;
  url: string;
  author: string;
  branch: string;
  draft: boolean;
  state: string; // human label
  level: Level;
  /** Review: approved, changes requested, waiting… */
  review: { label: string; level: Level } | null;
  /** "open", or "merged" / "closed" for the recent ones. */
  status: "open" | "merged" | "closed";
  /** When it was merged / closed / last updated (ms). */
  at: number | null;
  number: number;
  /** Head commit when it was read: the merge is refused if it moved since. */
  sha: string | null;
  target: string;
  squash: boolean;
  removeBranch: boolean;
}

export interface ForgeInfo {
  forge: Forge;
  base: string | null;
  requests: Request[];
  /** Merged or closed in the last days. */
  recent: Request[];
  ci: { label: string; level: Level; url: string | null } | null;
  error: string | null;
  at: number;
}

export const git = reactive({
  /** By workspace id. */
  status: {} as Record<string, GitStatus | null>,
  forge: {} as Record<string, ForgeInfo | undefined>,
  loading: false,
  /** Large Git window: open, and the file shown. */
  modal: { open: false, path: null as string | null },
});

// ---- Merge, after confirmation ------------------------------------------------

export const merging = reactive({
  open: false,
  req: null as Request | null,
  wsId: "",
  forge: "gitlab" as Forge,
  method: "merge" as "merge" | "squash" | "rebase",
  removeBranch: false,
  busy: false,
  error: "",
  result: "",
});

export function askMerge(wsId: string, req: Request) {
  const f = git.forge[wsId];
  Object.assign(merging, {
    open: true,
    req,
    wsId,
    forge: f?.forge ?? "gitlab",
    method: req.squash ? "squash" : "merge",
    removeBranch: req.removeBranch,
    busy: false,
    error: "",
  });
}

export async function confirmMerge(): Promise<boolean> {
  const r = merging.req;
  const root = git.status[merging.wsId]?.root;
  if (!r || !root) return false;
  merging.busy = true;
  merging.error = "";
  try {
    merging.result = await invoke<string>("forge_merge", {
      root,
      forge: merging.forge,
      number: r.number,
      sha: r.sha,
      method: merging.method,
      deleteBranch: merging.removeBranch,
      branch: r.branch,
    });
    merging.open = false;
    await refreshGit(merging.wsId);
    return true;
  } catch (e) {
    merging.error = String(e).split("\n").slice(0, 4).join("\n");
    return false;
  } finally {
    merging.busy = false;
  }
}

export function openGitModal(path: string | null = null) {
  git.modal.path = path;
  git.modal.open = true;
}

/** Folder of a workspace: the selected pane if it is in it, else its first pane. */
export function workspaceCwd(wsId: string): string | null {
  const sel = selectedPane.value;
  if (sel && sel.workspace_id === wsId) return sel.foreground_cwd || sel.cwd || null;
  const p = allPanes.value.find((x) => x.workspace_id === wsId && (x.foreground_cwd || x.cwd));
  return p ? p.foreground_cwd || p.cwd || null : null;
}

async function loadStatus(wsId: string) {
  const cwd = workspaceCwd(wsId);
  if (!cwd) {
    git.status[wsId] = null;
    return;
  }
  try {
    git.status[wsId] = await invoke<GitStatus | null>("git_status", { cwd });
  } catch {
    git.status[wsId] = null;
  }
}

function cli(cwd: string, tool: "glab" | "gh", args: string[]): Promise<string> {
  return invoke<string>("forge_cli", { cwd, tool, args });
}

// GitLab "detailed_merge_status" → what it means for you.
const GL_STATUS: Record<string, [string, Level]> = {
  mergeable: ["prête à fusionner", "ok"],
  ci_still_running: ["CI en cours", "pending"],
  ci_must_pass: ["CI à faire passer", "warn"],
  not_approved: ["à approuver", "warn"],
  approvals_syncing: ["approbations en cours", "pending"],
  conflict: ["conflit", "crit"],
  need_rebase: ["à rebaser", "warn"],
  draft_status: ["brouillon", "muted"],
  discussions_not_resolved: ["discussions ouvertes", "warn"],
  blocked_status: ["bloquée", "crit"],
  checking: ["vérification…", "pending"],
  unchecked: ["non vérifiée", "muted"],
  not_open: ["fermée", "muted"],
  requested_changes: ["changements demandés", "crit"],
  jira_association_missing: ["ticket manquant", "warn"],
  external_status_checks: ["contrôles externes", "pending"],
};

const PIPE: Record<string, [string, Level]> = {
  success: ["CI verte", "ok"],
  passed: ["CI verte", "ok"],
  failed: ["CI en échec", "crit"],
  failure: ["CI en échec", "crit"],
  running: ["CI en cours", "pending"],
  in_progress: ["CI en cours", "pending"],
  pending: ["CI en attente", "pending"],
  queued: ["CI en attente", "pending"],
  created: ["CI en attente", "pending"],
  canceled: ["CI annulée", "muted"],
  cancelled: ["CI annulée", "muted"],
  skipped: ["CI ignorée", "muted"],
  manual: ["CI manuelle", "warn"],
};

type GlMr = {
  iid: number;
  title: string;
  web_url: string;
  author?: { username?: string };
  source_branch: string;
  draft?: boolean;
  detailed_merge_status?: string;
  has_conflicts?: boolean;
  state?: string;
  sha?: string;
  target_branch?: string;
  squash?: boolean;
  force_remove_source_branch?: boolean;
  should_remove_source_branch?: boolean | null;
  merged_at?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
};

const time = (s?: string | null) => (s ? Date.parse(s) || null : null);

function glRequest(m: GlMr, status: Request["status"]): Request {
  const [state, level] =
    status === "merged"
      ? (["fusionnée", "ok"] as [string, Level])
      : status === "closed"
        ? (["fermée", "muted"] as [string, Level])
        : m.has_conflicts
          ? GL_STATUS.conflict
          : GL_STATUS[m.detailed_merge_status ?? ""] ?? [m.detailed_merge_status ?? "ouverte", "muted" as Level];
  return {
    ref: `!${m.iid}`,
    title: m.title,
    url: m.web_url,
    author: m.author?.username ?? "",
    branch: m.source_branch,
    draft: !!m.draft,
    state,
    level,
    review: m.detailed_merge_status === "requested_changes" ? { label: "changements demandés", level: "crit" } : null,
    status,
    at: time(m.merged_at) ?? time(m.closed_at) ?? time(m.updated_at),
    number: m.iid,
    sha: m.sha ?? null,
    target: m.target_branch ?? "",
    squash: !!m.squash,
    removeBranch: !!(m.force_remove_source_branch || m.should_remove_source_branch),
  };
}

async function loadGitlab(cwd: string, branch: string | null): Promise<Pick<ForgeInfo, "requests" | "recent" | "ci">> {
  const list = JSON.parse(
    await cli(cwd, "glab", ["api", "projects/:fullpath/merge_requests?state=opened&per_page=20&order_by=updated_at"]),
  ) as GlMr[];
  const requests = list.map((m) => glRequest(m, "open"));
  // Approvals: one small call per open MR (at most 15, four at a time).
  const queue = requests.slice(0, 15);
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) await approvals(r);
  };
  const approvals = async (r: Request) => {
      if (r.review) return;
      try {
        const a = JSON.parse(await cli(cwd, "glab", ["api", `projects/:fullpath/merge_requests/${r.ref.slice(1)}/approvals`])) as {
          approved?: boolean;
          approvals_left?: number;
          approved_by?: { user?: { username?: string } }[];
        };
        const by = a.approved_by ?? [];
        const who = by.map((x) => x.user?.username).filter(Boolean).join(", ");
        // "approved" is also true when the project has no approval rule: only count real approvals.
        if (by.length && !a.approvals_left) r.review = { label: `approuvée · ${who}`, level: "ok" };
        else if (by.length) r.review = { label: `${by.length} approbation(s), ${a.approvals_left} restante(s)`, level: "pending" };
        else if (!r.draft) r.review = { label: "en attente de revue", level: "warn" };
      } catch {
        /* approvals not available on this plan / project */
      }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  let recent: Request[] = [];
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const done = JSON.parse(
      await cli(cwd, "glab", ["api", `projects/:fullpath/merge_requests?state=all&updated_after=${encodeURIComponent(since)}&per_page=30&order_by=updated_at`]),
    ) as GlMr[];
    const week = Date.now() - 7 * 86_400_000;
    recent = done
      .filter((m) => (m.state === "merged" || m.state === "closed") && (time(m.merged_at) ?? time(m.closed_at) ?? 0) >= week)
      .map((m) => glRequest(m, m.state === "merged" ? "merged" : "closed"))
      .slice(0, 12);
  } catch {
    /* ignore */
  }
  let ci: ForgeInfo["ci"] = null;
  if (branch) {
    try {
      const p = JSON.parse(
        await cli(cwd, "glab", ["api", `projects/:fullpath/pipelines?ref=${encodeURIComponent(branch)}&per_page=1`]),
      ) as { status: string; web_url: string }[];
      if (p[0]) {
        const [label, level] = PIPE[p[0].status] ?? [p[0].status, "muted" as Level];
        ci = { label, level, url: p[0].web_url };
      }
    } catch {
      /* no CI on this project */
    }
  }
  return { requests, recent, ci };
}

type GhPr = {
  number: number;
  title: string;
  url: string;
  author?: { login?: string };
  headRefName: string;
  isDraft: boolean;
  reviewDecision?: string;
  mergeable?: string;
  statusCheckRollup?: { conclusion?: string; status?: string; state?: string }[];
  state?: string;
  mergedAt?: string | null;
  headRefOid?: string;
  baseRefName?: string;
  closedAt?: string | null;
  updatedAt?: string | null;
};

const GH_REVIEW: Record<string, { label: string; level: Level }> = {
  APPROVED: { label: "approuvée", level: "ok" },
  CHANGES_REQUESTED: { label: "changements demandés", level: "crit" },
  REVIEW_REQUIRED: { label: "en attente de revue", level: "warn" },
};

function ghRequest(p: GhPr, status: Request["status"]): Request {
  const checks = p.statusCheckRollup ?? [];
  const failed = checks.some((c) => ["FAILURE", "ERROR", "TIMED_OUT"].includes((c.conclusion || c.state || "").toUpperCase()));
  const running = checks.some((c) => ["IN_PROGRESS", "QUEUED", "PENDING"].includes((c.status || c.state || "").toUpperCase()));
  let state = "ouverte";
  let level: Level = "muted";
  if (status === "merged") [state, level] = ["fusionnée", "ok"];
  else if (status === "closed") [state, level] = ["fermée", "muted"];
  else if (p.isDraft) [state, level] = ["brouillon", "muted"];
  else if (p.mergeable === "CONFLICTING") [state, level] = ["conflit", "crit"];
  else if (failed) [state, level] = ["CI en échec", "crit"];
  else if (running) [state, level] = ["CI en cours", "pending"];
  else if (p.mergeable === "MERGEABLE") [state, level] = ["prête à fusionner", "ok"];
  return {
    ref: `#${p.number}`,
    title: p.title,
    url: p.url,
    author: p.author?.login ?? "",
    branch: p.headRefName,
    draft: p.isDraft,
    state,
    level,
    review: status === "open" ? GH_REVIEW[p.reviewDecision ?? ""] ?? null : null,
    status,
    at: time(p.mergedAt) ?? time(p.closedAt) ?? time(p.updatedAt),
    number: p.number,
    sha: p.headRefOid ?? null,
    target: p.baseRefName ?? "",
    squash: false,
    removeBranch: false,
  };
}

const GH_FIELDS =
  "number,title,url,author,headRefName,baseRefName,headRefOid,isDraft,reviewDecision,mergeable,statusCheckRollup,state,mergedAt,closedAt,updatedAt";

async function loadGithub(cwd: string, branch: string | null): Promise<Pick<ForgeInfo, "requests" | "recent" | "ci">> {
  const list = JSON.parse(await cli(cwd, "gh", ["pr", "list", "--limit", "20", "--json", GH_FIELDS])) as GhPr[];
  const requests = list.map((p) => ghRequest(p, "open"));
  let recent: Request[] = [];
  try {
    const week = Date.now() - 7 * 86_400_000;
    const merged = JSON.parse(await cli(cwd, "gh", ["pr", "list", "--state", "merged", "--limit", "10", "--json", GH_FIELDS])) as GhPr[];
    const closed = JSON.parse(await cli(cwd, "gh", ["pr", "list", "--state", "closed", "--limit", "10", "--json", GH_FIELDS])) as GhPr[];
    const seen = new Set<number>();
    recent = [...merged.map((p) => ghRequest(p, "merged")), ...closed.filter((p) => !p.mergedAt).map((p) => ghRequest(p, "closed"))]
      .filter((r) => !seen.has(Number(r.ref.slice(1))) && seen.add(Number(r.ref.slice(1))) && (r.at ?? 0) >= week)
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
      .slice(0, 12);
  } catch {
    /* ignore */
  }
  let ci: ForgeInfo["ci"] = null;
  if (branch) {
    try {
      const runs = JSON.parse(
        await cli(cwd, "gh", ["run", "list", "--branch", branch, "--limit", "1", "--json", "status,conclusion,url"]),
      ) as { status: string; conclusion: string; url: string }[];
      if (runs[0]) {
        const key = runs[0].status === "completed" ? runs[0].conclusion : runs[0].status;
        const [label, level] = PIPE[key] ?? [key, "muted" as Level];
        ci = { label, level, url: runs[0].url };
      }
    } catch {
      /* no Actions */
    }
  }
  return { requests, recent, ci };
}

function explain(e: unknown, tool: string): string {
  const s = String(e);
  if (/\b404\b/.test(s)) return "Projet introuvable sur l’hébergeur (remote ou accès).";
  if (/\b(401|403)\b|auth login|not logged|unauthorized|token/i.test(s)) return `${tool} n’est pas connecté à cet hébergeur (${tool} auth login).`;
  if (/command not found|No such file or directory/i.test(s)) return `${tool} n’est pas installé (brew install ${tool}).`;
  return s.split("\n")[0].slice(0, 200);
}

// Requests can come back out of order: only the latest one per workspace is kept.
const forgeSeq: Record<string, number> = {};

async function loadForge(wsId: string) {
  const seq = (forgeSeq[wsId] = (forgeSeq[wsId] ?? 0) + 1);
  const st = git.status[wsId];
  const cwd = st?.root;
  if (!cwd || !st?.remote) {
    git.forge[wsId] = undefined;
    return;
  }
  const ctx = await refContext(cwd);
  const forge: Forge = ctx.forge ?? "gitlab";
  const tool = forge === "github" ? "gh" : "glab";
  try {
    const r = forge === "github" ? await loadGithub(cwd, st.branch) : await loadGitlab(cwd, st.branch);
    if (seq === forgeSeq[wsId]) git.forge[wsId] = { forge, base: ctx.base, ...r, error: null, at: Date.now() };
  } catch (e) {
    if (seq === forgeSeq[wsId]) git.forge[wsId] = { forge, base: ctx.base, requests: [], recent: [], ci: null, error: explain(e, tool), at: Date.now() };
  }
}

/** Refresh now (button), status and forge of the selected workspace. */
export async function refreshGit(wsId = session.selectedWorkspaceId) {
  if (!wsId) return;
  git.loading = true;
  try {
    await loadStatus(wsId);
    await loadForge(wsId);
  } finally {
    git.loading = false;
  }
}

export const currentGit = computed(() => (session.selectedWorkspaceId ? git.status[session.selectedWorkspaceId] ?? null : null));
export const currentForge = computed(() => (session.selectedWorkspaceId ? git.forge[session.selectedWorkspaceId] : undefined));

let started = false;
/**
 * Local status: selected workspace every 10 s, all of them every 60 s (cheap).
 * Forge: selected workspace every 90 s, and when it changes.
 */
export function startGit() {
  if (started) return;
  started = true;
  let tick = 0;
  window.setInterval(() => {
    tick++;
    const sel = session.selectedWorkspaceId;
    if (sel) loadStatus(sel);
    if (tick % 6 === 0) for (const w of workspaces.value) if (w.workspace_id !== sel) loadStatus(w.workspace_id);
    if (sel && tick % 9 === 0) loadForge(sel);
  }, 10_000);
  watch(
    () => session.selectedWorkspaceId,
    (id) => id && refreshGit(id),
    { immediate: true },
  );
  // First pass for the sidebar badges, once panes are known.
  window.setTimeout(() => workspaces.value.forEach((w) => loadStatus(w.workspace_id)), 1500);
}
