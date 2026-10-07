// Global search (⇧⌘F) in what every pane has printed (Herdr's recent history).
import { reactive } from "vue";
import * as api from "../lib/api";
import { allPanes, paneFullName } from "./session";
import type { AgentInfo } from "../lib/types";

export const search = reactive({
  open: false,
  /** Asked of the terminal once the pane is shown: highlight this text if on screen. */
  jump: null as { paneId: string; line: string; start: number; end: number; seq: number } | null,
});

export interface SearchHit {
  line: string;
  before: string;
  after: string;
  /** Match position in `line`, for the highlight. */
  start: number;
  end: number;
}

export interface SearchGroup {
  pane: AgentInfo;
  where: string;
  hits: SearchHit[];
  total: number;
}

/** Lowercase, no accents, same length as the input (positions stay valid). */
export function fold(s: string): string {
  // Fast path: most terminal lines are plain ASCII.
  if (/^[\x00-\x7f]*$/.test(s)) return s.toLowerCase();
  let out = "";
  for (const ch of s) {
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    // A character that decomposes into several (rare: ligatures) keeps its length.
    out += (base.length === ch.length ? base : ch).toLowerCase();
  }
  return out.length === s.length ? out : s.toLowerCase();
}

// Reads are kept a few seconds: typing a longer query does not read everything again.
const cache = new Map<string, { at: number; lines: string[]; folded: string[] }>();
const LINES = 3000;
const TTL = 8000;

async function linesOf(paneId: string): Promise<{ lines: string[]; folded: string[] }> {
  const c = cache.get(paneId);
  if (c && Date.now() - c.at < TTL) return c;
  const text = await api.read(paneId, LINES).catch(() => "");
  // Trailing spaces and the empty tail of the screen are not results.
  const lines = text.split("\n").map((l) => l.replace(/\s+$/, ""));
  // Folded once per read, not once per keystroke.
  const entry = { at: Date.now(), lines, folded: lines.map(fold) };
  cache.set(paneId, entry);
  return entry;
}

/** Runs `fn` over `items`, `limit` at a time. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

/** Works on folded lines. A regex keeps its case (\S is not \s): only accents go, and "i" does the rest. */
export function matcher(query: string, regex: boolean): ((folded: string) => [number, number] | null) | string {
  if (regex) {
    let re: RegExp;
    try {
      re = new RegExp(query.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), "i");
    } catch (e) {
      return `Expression invalide : ${(e as Error).message}`;
    }
    return (line) => {
      const m = re.exec(line);
      return m && m[0].length ? [m.index, m.index + m[0].length] : null;
    };
  }
  const q = fold(query);
  return (line) => {
    const i = line.indexOf(q);
    return i === -1 ? null : [i, i + q.length];
  };
}

export async function runSearch(
  query: string,
  opts: { regex: boolean; agentsOnly: boolean; workspaceId: string | null },
): Promise<{ groups: SearchGroup[]; error?: string }> {
  const m = matcher(query, opts.regex);
  if (typeof m === "string") return { groups: [], error: m };
  const panes = allPanes.value.filter((p) => (!opts.agentsOnly || p.agent) && (!opts.workspaceId || p.workspace_id === opts.workspaceId));
  const groups = await pool(panes, 8, async (pane) => {
    const { lines, folded } = await linesOf(pane.pane_id);
    const hits: SearchHit[] = [];
    let total = 0;
    // Most recent first: that is usually the one looked for.
    for (let i = lines.length - 1; i >= 0; i--) {
      const r = m(folded[i]);
      if (!r) continue;
      total++;
      if (hits.length < 5) hits.push({ line: lines[i], before: lines[i - 1] ?? "", after: lines[i + 1] ?? "", start: r[0], end: r[1] });
    }
    return { pane, where: paneFullName(pane), hits, total };
  });
  return { groups: groups.filter((g) => g.total > 0).sort((a, b) => b.total - a.total) };
}

let jumpSeq = 0;
/** The whole line is passed: the terminal finds that occurrence, not just any match. */
export function requestJump(paneId: string, line: string, start: number, end: number) {
  search.jump = { paneId, line, start, end, seq: ++jumpSeq };
}

export function clearSearchCache() {
  cache.clear();
}
