// File explorer (read only for now): the project of a pane, its tree, open tabs.
import { markRaw, reactive, watch } from "vue";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "./session";

interface FileList {
  root: string;
  git: boolean;
  files: string[];
  status: Record<string, string>;
  truncated: boolean;
}

export const files = reactive({
  open: false,
  loading: false,
  error: "",
  root: "",
  git: false,
  list: [] as string[],
  status: {} as Record<string, string>,
  truncated: false,
  showIgnored: false,
  /** Open tabs (relative paths) and the one shown. */
  tabs: [] as string[],
  active: null as string | null,
  /** Line to show and highlight once the file is loaded. */
  line: null as number | null,
  expanded: new Set<string>(),
  lineTick: 0,
  /** Files being edited, by path. */
  edits: {} as Record<string, Edit>,
  /** ⌘Q (or closing the window) was stopped: unsaved files are shown first. */
  quitting: false,
  /** Bumped to focus the quick search (⌘P). */
  searchTick: 0,
});

export interface Edit {
  /** Content when read from the disk, and its fingerprint (a save checks it). */
  original: string;
  /** null: the file was deleted on the disk. */
  hash: string | null;
  /** What the editor holds now. */
  current: string;
  /** The disk changed meanwhile (an agent?): what is there now, and its fingerprint. */
  conflict: boolean;
  disk: string | null;
  diskHash: string | null;
  saving: boolean;
}

interface FileText {
  text: string;
  hash: string;
}

export const isDirty = (path: string | null | undefined) => !!path && !!files.edits[path] && files.edits[path].current !== files.edits[path].original;
/** Every edited file not saved, open in a tab or not. */
export const dirtyTabs = () => Object.keys(files.edits).filter((t) => isDirty(t));

// The app asks before quitting (⌘Q, closing the window) while files are not saved.
watch(
  () => dirtyTabs().length > 0,
  (on) => invoke("set_unsaved", { on }).catch(() => {}),
);

const fresh = (r: FileText): Edit => ({ original: r.text, current: r.text, hash: r.hash, conflict: false, disk: null, diskHash: null, saving: false });

export async function startEdit(path: string) {
  try {
    files.edits[path] = fresh(await invoke<FileText>("file_read", { root: files.root, path }));
  } catch (e) {
    toast(String(e));
  }
}

/** Leaves edit mode (the caller asked first when there were changes). */
export function stopEdit(path: string) {
  delete files.edits[path];
}

/** Back to what is on the disk now (changes dropped). */
export async function reloadEdit(path: string) {
  try {
    files.edits[path] = fresh(await invoke<FileText>("file_read", { root: files.root, path }));
  } catch (e) {
    toast(String(e));
  }
}

/**
 * Saves the edited file, only if the disk still holds the version the editor
 * started from. `overwrite`: replace the disk version shown in the conflict (and
 * only that one: if it changed again, the conflict is refreshed instead).
 */
export async function saveEdit(path: string, overwrite = false): Promise<boolean> {
  const ed = files.edits[path];
  if (!ed || ed.saving) return false;
  ed.saving = true;
  try {
    const content = ed.current;
    const st = await invoke<{ hash: string | null }>("file_write", {
      root: files.root,
      path,
      content,
      expected: overwrite ? ed.diskHash : ed.hash,
    });
    Object.assign(ed, { original: content, hash: st.hash, conflict: false, disk: null, diskHash: null });
    toast(`${path.split("/").pop()} enregistré`);
    // Git state of the tree (M, U…) follows.
    reloadFiles();
    return true;
  } catch (e) {
    if (String(e).includes("changed_on_disk")) {
      if (overwrite) toast("Le fichier a encore changé sur le disque : regarde la nouvelle différence");
      await markConflict(path);
    } else toast(String(e));
    return false;
  } finally {
    ed.saving = false;
  }
}

async function markConflict(path: string) {
  const ed = files.edits[path];
  if (!ed) return;
  ed.conflict = true;
  try {
    const st = await invoke<{ hash: string | null }>("file_stat", { root: files.root, path });
    if (st.hash === null) {
      ed.disk = null;
      ed.diskHash = null;
      return;
    }
    const r = await invoke<FileText>("file_read", { root: files.root, path });
    ed.disk = r.text;
    ed.diskHash = r.hash;
  } catch {
    /* shown as "changed", without the other version */
  }
}

/**
 * Looks at the edited file on the disk: untouched here → reloaded quietly; changes
 * in progress (or typed during the reload) → the conflict is shown at once rather
 * than at the save. While a conflict is shown, a new change on the disk refreshes it.
 */
export async function checkEdit(path: string) {
  const ed = files.edits[path];
  if (!ed || ed.saving) return;
  let st: { hash: string | null };
  try {
    st = await invoke("file_stat", { root: files.root, path });
  } catch {
    return;
  }
  if (ed.conflict) {
    if (st.hash !== ed.diskHash) await markConflict(path);
    return;
  }
  if (st.hash === ed.hash) return;
  if (!isDirty(path) && st.hash !== null) {
    const r = await invoke<FileText>("file_read", { root: files.root, path }).catch(() => null);
    const now = files.edits[path];
    if (!r || !now) return;
    // Typed something while the file was being read: not replaced, it is a conflict.
    if (now.current !== now.original) return markConflict(path);
    files.edits[path] = fresh(r);
    toast(`${path.split("/").pop()} modifié sur le disque (un agent ?) : rechargé`);
  } else await markConflict(path);
}

/** Drops every unsaved change ("Abandonner"). */
export function discardAll() {
  files.edits = {};
}

let cwdOpen: string | null = null;
let loadSeq = 0;

/** False when the project could not be shown (error, or unsaved files elsewhere). */
export async function loadFiles(cwd: string): Promise<boolean> {
  files.loading = true;
  files.error = "";
  const my = ++loadSeq;
  try {
    const r = await invoke<FileList>("files_list", { cwd, ignored: files.showIgnored });
    // A later request (another project) won: this answer is dropped.
    if (my !== loadSeq) return false;
    const sameRoot = r.root === files.root;
    if (!sameRoot && files.root && dirtyTabs().length) {
      toast("Des fichiers modifiés ne sont pas enregistrés : enregistre-les ou ferme leurs onglets d’abord");
      return false;
    }
    // Large and read-only: not made deeply reactive (50 000 paths).
    Object.assign(files, { root: r.root, git: r.git, list: markRaw(r.files), status: markRaw(r.status), truncated: r.truncated });
    if (!sameRoot) {
      // Another project: unsaved edits are not carried over (the caller asked first).
      files.tabs = [];
      files.active = null;
      files.expanded = new Set();
      files.edits = {};
    }
    cwdOpen = cwd;
    return true;
  } catch (e) {
    if (my === loadSeq) files.error = String(e);
    return false;
  } finally {
    if (my === loadSeq) files.loading = false;
  }
}

listen("quit-blocked", () => {
  files.open = true;
  files.quitting = true;
}).catch(() => {});

export async function quitNow() {
  await invoke("quit_now").catch(() => {});
}

export function reloadFiles() {
  if (cwdOpen) return loadFiles(cwdOpen);
}

/** Expands the folders leading to a file. */
function reveal(path: string) {
  const parts = path.split("/");
  const next = new Set(files.expanded);
  for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join("/"));
  files.expanded = next;
}

export function openTab(path: string, line: number | null = null) {
  if (!files.tabs.includes(path)) {
    const tabs = [...files.tabs, path];
    // 12 tabs at most, dropping the oldest ones that hold nothing unsaved.
    while (tabs.length > 12) {
      const i = tabs.findIndex((t) => t !== path && !isDirty(t));
      if (i === -1) break;
      delete files.edits[tabs[i]];
      tabs.splice(i, 1);
    }
    files.tabs = tabs;
  }
  files.active = path;
  files.line = line;
  // Same file, new line: the view scrolls to it (watched together with the path).
  files.lineTick++;
  reveal(path);
}

export function closeTab(path: string) {
  delete files.edits[path];
  const i = files.tabs.indexOf(path);
  files.tabs = files.tabs.filter((t) => t !== path);
  if (files.active === path) {
    files.active = files.tabs[Math.min(i, files.tabs.length - 1)] ?? null;
    files.line = null; // the line belonged to the closed file
  }
}

/** Opens the explorer on the project of `cwd` (optionally a file at a line, or the quick search). */
export async function openFiles(cwd: string | null | undefined, opts: { path?: string; line?: number | null; search?: boolean } = {}) {
  if (!cwd) return toast("Dossier du panneau inconnu");
  files.open = true;
  if ((cwd !== cwdOpen || !files.list.length) && !(await loadFiles(cwd)) && cwd !== cwdOpen) return;
  if (opts.path) openTab(opts.path, opts.line ?? null);
  if (opts.search) files.searchTick++;
}

/** "src/app.ts:42" seen in a terminal: resolved from the pane's folder, then opened. */
export async function openFileRef(cwd: string | null | undefined, path: string, line: number | null) {
  if (!cwd) return toast("Dossier du panneau inconnu");
  try {
    const r = await invoke<{ root: string; path: string }>("files_resolve", { cwd, path });
    files.open = true;
    if ((r.root !== files.root || !files.list.length) && !(await loadFiles(r.root))) return;
    openTab(r.path, line);
  } catch (e) {
    toast(String(e));
  }
}

// ---- Quick search ---------------------------------------------------------------

/**
 * Fuzzy match: the letters in order; "/" in the query moves to the next folder.
 * Higher score: matches at the start of words / segments, shorter paths, file name.
 */
export function fuzzyScore(query: string, path: string): number | null {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return 0;
  const p = path.toLowerCase();
  let score = 0;
  let pi = 0;
  let last = -2;
  for (const ch of q) {
    let found = -1;
    if (ch === "/") {
      found = p.indexOf("/", pi);
    } else {
      for (let i = pi; i < p.length; i++) {
        if (p[i] === ch) {
          found = i;
          break;
        }
      }
    }
    if (found === -1) return null;
    const prev = p[found - 1];
    if (found === 0 || prev === "/" || prev === "-" || prev === "_" || prev === ".") score += 8;
    if (found === last + 1) score += 5;
    last = found;
    pi = found + 1;
  }
  const name = p.slice(p.lastIndexOf("/") + 1);
  if (name.includes(q)) score += 25;
  if (name.startsWith(q)) score += 15;
  return score - p.length * 0.15;
}

export function quickSearch(query: string, list: string[], max = 80): string[] {
  const out: { p: string; s: number }[] = [];
  for (const p of list) {
    if (p.endsWith("/")) continue;
    const s = fuzzyScore(query, p);
    if (s !== null) out.push({ p, s });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, max).map((x) => x.p);
}

// ---- Tree -----------------------------------------------------------------------

export interface TreeRow {
  path: string;
  name: string;
  depth: number;
  dir: boolean;
  ignored: boolean;
  /** Git state of the file, or "•" for a folder holding changes. */
  status: string | null;
}

interface Node {
  dirs: Map<string, Node>;
  files: string[];
}

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

export function buildTree(list: string[]): Node {
  const root: Node = { dirs: new Map(), files: [] };
  for (const path of list) {
    const ignoredDir = path.endsWith("/");
    const parts = (ignoredDir ? path.slice(0, -1) : path).split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let next = node.dirs.get(parts[i]);
      if (!next) node.dirs.set(parts[i], (next = { dirs: new Map(), files: [] }));
      node = next;
    }
    const last = parts[parts.length - 1];
    if (ignoredDir) {
      if (!node.dirs.has(last + "/")) node.dirs.set(last + "/", { dirs: new Map(), files: [] });
    } else node.files.push(last);
  }
  // Sorted once here, not at every expand.
  const sortNode = (n: Node) => {
    n.files.sort(collator.compare);
    n.dirs = new Map([...n.dirs.entries()].sort((a, b) => collator.compare(a[0], b[0])));
    n.dirs.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

/** Visible rows: folders first, then files, A→Z; only expanded folders are opened. */
export function visibleRows(tree: Node, expanded: Set<string>, status: Record<string, string>): TreeRow[] {
  const changedDirs = new Set<string>();
  for (const p of Object.keys(status)) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) changedDirs.add(parts.slice(0, i).join("/"));
  }
  const rows: TreeRow[] = [];
  const walk = (node: Node, prefix: string, depth: number) => {
    for (const name of node.dirs.keys()) {
      const ignored = name.endsWith("/");
      const clean = ignored ? name.slice(0, -1) : name;
      const path = prefix ? `${prefix}/${clean}` : clean;
      rows.push({ path, name: clean, depth, dir: true, ignored, status: changedDirs.has(path) ? "•" : null });
      if (!ignored && expanded.has(path)) walk(node.dirs.get(name)!, path, depth + 1);
    }
    for (const name of node.files) {
      const path = prefix ? `${prefix}/${name}` : name;
      rows.push({ path, name, depth, dir: false, ignored: false, status: status[path] ?? null });
    }
  };
  walk(tree, "", 0);
  return rows;
}

export const isImage = (path: string) => /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(path);

// ---- Search, create, rename, delete (lot 3) ---------------------------------------

export interface GrepHit {
  path: string;
  line: number;
  text: string;
}

export async function grepFiles(query: string, regex: boolean, caseSensitive: boolean) {
  return invoke<{ hits: GrepHit[]; truncated: boolean }>("files_grep", { root: files.root, query, regex, case: caseSensitive });
}

export async function createFile(path: string, dir: boolean): Promise<boolean> {
  try {
    await invoke("file_create", { root: files.root, path, dir });
    await reloadFiles();
    if (dir) {
      const next = new Set(files.expanded);
      next.add(path);
      files.expanded = next;
    } else {
      openTab(path);
      await startEdit(path);
    }
    return true;
  } catch (e) {
    toast(String(e));
    return false;
  }
}

/** Rename / move; open tabs and edits inside follow. */
export async function renameFile(from: string, to: string): Promise<boolean> {
  if (from === to) return true;
  if (dirtyTabs().some((t) => t === from || t.startsWith(from + "/"))) {
    toast("Enregistre d’abord les fichiers modifiés concernés");
    return false;
  }
  try {
    await invoke("file_rename", { root: files.root, from, to });
    const move = (p: string) => (p === from ? to : p.startsWith(from + "/") ? to + p.slice(from.length) : p);
    files.tabs = files.tabs.map(move);
    if (files.active) files.active = move(files.active);
    const edits: Record<string, Edit> = {};
    for (const [k, v] of Object.entries(files.edits)) edits[move(k)] = v;
    files.edits = edits;
    await reloadFiles();
    return true;
  } catch (e) {
    toast(String(e));
    return false;
  }
}

/** To the macOS Trash (recoverable from the Finder). */
export async function trashFile(path: string): Promise<boolean> {
  const under = (p: string) => p === path || p.startsWith(path + "/");
  if (dirtyTabs().some(under)) {
    toast("Des fichiers modifiés non enregistrés sont concernés : enregistre-les ou annule d’abord");
    return false;
  }
  try {
    await invoke("file_trash", { root: files.root, path });
    for (const k of Object.keys(files.edits)) if (under(k)) delete files.edits[k];
    for (const t of [...files.tabs]) if (under(t)) closeTab(t);
    await reloadFiles();
    toast(`${path.split("/").pop()} mis à la Corbeille`);
    return true;
  } catch (e) {
    toast(String(e));
    return false;
  }
}
