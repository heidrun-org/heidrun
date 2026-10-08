// File explorer (read only for now): the project of a pane, its tree, open tabs.
import { markRaw, reactive } from "vue";
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
  /** Bumped to focus the quick search (⌘P). */
  searchTick: 0,
});

let cwdOpen: string | null = null;
let loadSeq = 0;

export async function loadFiles(cwd: string) {
  files.loading = true;
  files.error = "";
  const my = ++loadSeq;
  try {
    const r = await invoke<FileList>("files_list", { cwd, ignored: files.showIgnored });
    // A later request (another project) won: this answer is dropped.
    if (my !== loadSeq) return;
    const sameRoot = r.root === files.root;
    // Large and read-only: not made deeply reactive (50 000 paths).
    Object.assign(files, { root: r.root, git: r.git, list: markRaw(r.files), status: markRaw(r.status), truncated: r.truncated });
    if (!sameRoot) {
      files.tabs = [];
      files.active = null;
      files.expanded = new Set();
    }
    cwdOpen = cwd;
  } catch (e) {
    if (my === loadSeq) files.error = String(e);
  } finally {
    if (my === loadSeq) files.loading = false;
  }
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
  if (!files.tabs.includes(path)) files.tabs = [...files.tabs, path].slice(-12);
  files.active = path;
  files.line = line;
  // Same file, new line: the view scrolls to it (watched together with the path).
  files.lineTick++;
  reveal(path);
}

export function closeTab(path: string) {
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
  if (cwd !== cwdOpen || !files.list.length) await loadFiles(cwd);
  if (opts.path) openTab(opts.path, opts.line ?? null);
  if (opts.search) files.searchTick++;
}

/** "src/app.ts:42" seen in a terminal: resolved from the pane's folder, then opened. */
export async function openFileRef(cwd: string | null | undefined, path: string, line: number | null) {
  if (!cwd) return toast("Dossier du panneau inconnu");
  try {
    const r = await invoke<{ root: string; path: string }>("files_resolve", { cwd, path });
    files.open = true;
    if (r.root !== files.root || !files.list.length) await loadFiles(r.root);
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
