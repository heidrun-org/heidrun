// Issue / MR / PR / ticket / commit references in terminal output:
// found per screen line, then colored (decorations) and made clickable (link provider).
import { invoke } from "@tauri-apps/api/core";

export type RefKind = "issue" | "mr" | "ticket" | "commit";
export type Forge = "github" | "gitlab";

export interface RefMatch {
  start: number; // index in the line text
  end: number; // exclusive
  kind: RefKind;
  url: string | null;
}

export interface RefContext {
  /** Web URL of the repository, e.g. https://gitlab.com/group/app */
  base: string | null;
  /** Web origin, e.g. https://gitlab.com (for `group/app#12`) */
  origin: string | null;
  forge: Forge | null;
  /** Ticket URL template with {key}, e.g. https://acme.atlassian.net/browse/{key} */
  ticketUrl: string | null;
  /** Restricts tickets to these prefixes (["ABC", "OPS"]); all if empty. */
  ticketPrefixes: string[];
  enabled: boolean;
}

export const REF_COLORS: Record<RefKind, string> = {
  issue: "#79b8ff",
  mr: "#c29bf0",
  ticket: "#6fd0c8",
  commit: "#e0b080",
};

export const EMPTY_CONTEXT: RefContext = {
  base: null,
  origin: null,
  forge: null,
  ticketUrl: null,
  ticketPrefixes: [],
  enabled: true,
};

/** git@host:group/app.git, ssh://git@host:22/group/app, https://user@host/group/app.git → https://host/group/app */
export function remoteToWeb(remote: string): { base: string; origin: string; host: string } | null {
  let r = remote.trim();
  let host = "";
  let path = "";
  let m = /^[\w.-]+@([^:/]+):(?!\d+\/)(.+)$/.exec(r); // scp-like
  if (m) {
    host = m[1];
    path = m[2];
  } else {
    m = /^(?:ssh|git|https?):\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/.exec(r);
    if (!m) return null;
    host = m[1];
    path = m[2];
  }
  path = path.replace(/\.git\/?$/, "").replace(/\/+$/, "");
  if (!host || !path) return null;
  return { base: `https://${host}/${path}`, origin: `https://${host}`, host };
}

const cache = new Map<string, Promise<RefContext>>();

/** Context for a pane's folder; cached per folder. */
export function refContext(cwd: string | null | undefined): Promise<RefContext> {
  const key = cwd || "";
  if (!key) return Promise.resolve(EMPTY_CONTEXT);
  let p = cache.get(key);
  if (!p) {
    p = load(key);
    cache.set(key, p);
    // Remotes rarely change, but a new clone in the same folder should be picked up.
    window.setTimeout(() => cache.delete(key), 5 * 60_000);
  }
  return p;
}

async function load(cwd: string): Promise<RefContext> {
  try {
    const r = await invoke<{ root: string; remote: string | null; references: Record<string, unknown> | null }>(
      "project_refs",
      { cwd },
    );
    const conf = (r.references ?? {}) as {
      enabled?: boolean;
      forge?: Forge;
      repo?: string;
      tickets?: string | { url?: string; prefixes?: string[] };
    };
    // "repo" in .herdr-desk.json overrides the git remote (any form git accepts, or the web URL).
    const source = conf.repo ?? r.remote;
    const web = source ? remoteToWeb(source) : null;
    // Unknown hosts are most often self-hosted GitLab; GitHub is github.com.
    const forge: Forge | null = conf.forge ?? (web ? (web.host.includes("github") ? "github" : "gitlab") : null);
    const tickets = typeof conf.tickets === "string" ? { url: conf.tickets } : conf.tickets ?? {};
    return {
      base: web?.base ?? null,
      origin: web?.origin ?? null,
      forge,
      ticketUrl: tickets.url ?? null,
      ticketPrefixes: (tickets.prefixes ?? []).map((x) => x.toUpperCase()),
      enabled: conf.enabled !== false,
    };
  } catch {
    return EMPTY_CONTEXT;
  }
}

function issueUrl(base: string | null, forge: Forge | null, n: string): string | null {
  if (!base) return null;
  return forge === "github" ? `${base}/issues/${n}` : `${base}/-/issues/${n}`;
}

function mrUrl(base: string | null, forge: Forge | null, n: string): string | null {
  if (!base) return null;
  return forge === "github" ? `${base}/pull/${n}` : `${base}/-/merge_requests/${n}`;
}

// Words that look like tickets but are not (UTF-8, SHA-256…), when no prefix list is set.
const NOT_TICKETS = new Set(["UTF", "ISO", "SHA", "RFC", "CVE", "GPT", "MD", "HTTP", "TLS", "SSL", "ES", "IPV", "X", "COVID", "MP", "AES", "RSA"]);

/** All references in one line of text, without overlaps. */
export function findRefs(line: string, ctx: RefContext): RefMatch[] {
  if (!ctx.enabled || line.trim().length < 2) return [];
  const out: RefMatch[] = [];
  const taken = (s: number, e: number) => out.some((m) => s < m.end && e > m.start);
  const add = (s: number, e: number, kind: RefKind, url: string | null) => {
    if (!taken(s, e)) out.push({ start: s, end: e, kind, url });
  };
  let m: RegExpExecArray | null;

  // Skip URLs: the web links addon handles them, and "#123" inside one is not ours.
  const urls: [number, number][] = [];
  const urlRe = /\bhttps?:\/\/[^\s"'<>)\]]+/g;
  while ((m = urlRe.exec(line))) urls.push([m.index, m.index + m[0].length]);
  const inUrl = (i: number) => urls.some(([s, e]) => i >= s && i < e);

  // 1. "PR #12", "MR !34", "merge request 34", "pull request #5"
  const explicit = /\b(PR|MR|pull request|merge request)\s?([#!]?)(\d+)\b/gi;
  while ((m = explicit.exec(line))) {
    if (inUrl(m.index)) continue;
    add(m.index, m.index + m[0].length, "mr", mrUrl(ctx.base, ctx.forge, m[3]));
  }

  // 2. "group/app#12", "group/app!34" (another repository on the same forge)
  const cross = /(?<![\w/.:-])([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)([#!])(\d+)\b/g;
  while ((m = cross.exec(line))) {
    if (inUrl(m.index)) continue;
    const base = ctx.origin ? `${ctx.origin}/${m[1]}` : null;
    const isMr = m[2] === "!";
    add(m.index, m.index + m[0].length, isMr ? "mr" : "issue", isMr ? mrUrl(base, ctx.forge, m[3]) : issueUrl(base, ctx.forge, m[3]));
  }

  // 3. "!34": GitLab merge request
  if (ctx.forge !== "github") {
    const bang = /(?<![\w!])!(\d+)\b/g;
    while ((m = bang.exec(line))) {
      if (inUrl(m.index)) continue;
      add(m.index, m.index + m[0].length, "mr", mrUrl(ctx.base, ctx.forge, m[1]));
    }
  }

  // 4. "#12": issue (GitHub redirects to the PR when it is one)
  const hash = /(?<![\w&#/])#(\d+)\b/g;
  while ((m = hash.exec(line))) {
    if (inUrl(m.index)) continue;
    add(m.index, m.index + m[0].length, "issue", issueUrl(ctx.base, ctx.forge, m[1]));
  }

  // 5. Tickets "ABC-123": only when the project sets a ticket URL.
  if (ctx.ticketUrl) {
    const ticket = /\b([A-Z][A-Z0-9]{1,9})-(\d+)\b/g;
    while ((m = ticket.exec(line))) {
      if (inUrl(m.index)) continue;
      const prefix = m[1];
      if (ctx.ticketPrefixes.length ? !ctx.ticketPrefixes.includes(prefix) : NOT_TICKETS.has(prefix)) continue;
      add(m.index, m.index + m[0].length, "ticket", ctx.ticketUrl.replace("{key}", m[0]));
    }
  }

  // 6. Commit hashes: 7–40 hex chars with both letters and digits.
  const sha = /(?<![\w-])[0-9a-f]{7,40}(?![\w-])/g;
  while ((m = sha.exec(line))) {
    const h = m[0];
    if (inUrl(m.index) || !/[a-f]/.test(h) || !/\d/.test(h)) continue;
    add(m.index, m.index + h.length, "commit", ctx.base ? (ctx.forge === "github" ? `${ctx.base}/commit/${h}` : `${ctx.base}/-/commit/${h}`) : null);
  }

  return out.sort((a, b) => a.start - b.start);
}

// ---- Things the agent suggests doing: slash commands and numbered steps ------

const commandCache = new Map<string, Promise<Set<string>>>();

/** Slash commands Claude Code knows in this folder (built-ins, user, project, plugins). */
export function claudeCommands(cwd: string | null | undefined): Promise<Set<string>> {
  const key = cwd || "";
  let p = commandCache.get(key);
  if (!p) {
    p = invoke<string[]>("claude_commands", { cwd: cwd || null })
      .then((list) => new Set(list.map((c) => c.toLowerCase())))
      .catch(() => new Set<string>());
    commandCache.set(key, p);
    window.setTimeout(() => commandCache.delete(key), 2 * 60_000);
  }
  return p;
}

export interface CommandMatch {
  start: number;
  end: number;
  command: string; // "/fin-tache"
}

/** "/fin-tache", "/compact"… but only real commands, never paths like /tmp/x. */
export function findCommands(line: string, known: Set<string>): CommandMatch[] {
  if (!known.size || !line.includes("/")) return [];
  const out: CommandMatch[] = [];
  const re = /(?<![\w/.~:-])\/([a-z][\w:-]*\w)(?![\w/]|\.\w)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (known.has(m[1].toLowerCase())) out.push({ start: m.index, end: m.index + m[0].length, command: m[0] });
  }
  return out;
}

export interface StepMatch {
  start: number; // the "1." marker
  end: number;
  number: number;
  text: string; // first line of the item, for the prompt
}

/** "  1. Ouvrir une issue…", "2) Committer…": an item of a numbered list. */
export function findStep(line: string): StepMatch | null {
  const m = /^(\s{0,8})(\d{1,2})[.)]\s+(\S.*?)\s*$/.exec(line);
  if (!m || m[3].length < 4) return null;
  const start = m[1].length;
  return { start, end: line.length - (line.length - line.trimEnd().length), number: Number(m[2]), text: m[3] };
}

// ---- Shell commands for Claude's "!" mode ------------------------------------

export interface ShellBlock {
  /** First and last screen lines of the command (0-based). */
  first: number;
  last: number;
  /** Where the "!" sits on the first line (index in its text). */
  start: number;
  /** The command as one line, without the "!". */
  command: string;
}

const NEW_ITEM = /^\s*(?:[!•⏺⎿>❯$#*-]|\d{1,2}[.)]\s)/;
const BANG = /^(\s*)!\s*(\S.*)$/;
const indentOf = (s: string) => s.length - s.trimStart().length;

/**
 * "! docker builder prune -af && docker image prune -af", possibly spread over
 * several screen lines (wrapped by the agent, or continued with \, &&, |).
 * `lineAt(i)` returns the text of screen line i (or null past the end).
 */
export function findShellBlock(lineAt: (i: number) => string | null, y: number, cols: number): ShellBlock | null {
  // The hovered line may be a continuation: look a few lines up for the "!".
  for (let first = y; first >= Math.max(0, y - 8); first--) {
    const head = lineAt(first);
    if (head == null) break;
    const m = BANG.exec(head);
    if (!m || /^!\w/.test(m[2])) {
      if (!head.trim()) break; // a blank line ends any block
      continue;
    }
    const bangIndent = m[1].length;
    const parts = [m[2].trimEnd()];
    let last = first;
    let prev = head.trimEnd();
    for (let i = first + 1; i < first + 12; i++) {
      const line = lineAt(i);
      if (line == null || !line.trim()) break;
      const indent = indentOf(line);
      const continued = /(\\|&&|\|\||\||;)$/.test(prev);
      const wrapped = prev.length >= cols - 12; // the previous line ran to the edge
      if (indent < bangIndent || (!continued && NEW_ITEM.test(line))) break;
      if (!continued && !wrapped && indent <= bangIndent) break;
      parts.push(line.trim());
      prev = line.trimEnd();
      last = i;
    }
    if (y > last) return null;
    const command = parts
      .map((p) => p.replace(/\s*\\$/, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (command.length < 2) return null;
    return { first, last, start: bangIndent, command };
  }
  return null;
}

// ---- Claude Code's agent list under the prompt ("● main", "○ jerome-645 …") -----

// Filled marker = the agent shown; hollow = the others. Several glyphs, depending on
// the Claude Code version and the font.
const AGENT_ROW = /^(\s{0,12}(?:[❯›>▸▶]\s*)?)([●○◉◯◎⬤⏺•◦∘⦿])\s+([\w.@:/-]+)(?:\s{2,}\S.*)?\s*$/u;

export interface AgentRow {
  /** Position in the list (0 = first row, usually "main"). */
  index: number;
  name: string;
  /** Index in the line text where the marker starts. */
  start: number;
  current: boolean;
}

/**
 * The background agents / teammates list Claude Code shows below its prompt.
 * Only near the bottom of the screen, as a block of at least two rows.
 */
export function findAgentRow(lineAt: (i: number) => string | null, y: number, rows: number): AgentRow | null {
  if (y < rows - 24) return null;
  const line = lineAt(y);
  const m = line != null ? AGENT_ROW.exec(line) : null;
  if (!m) return null;
  let first = y;
  while (first > 0 && AGENT_ROW.test(lineAt(first - 1) ?? "")) first--;
  let last = y;
  while (AGENT_ROW.test(lineAt(last + 1) ?? "")) last++;
  if (last - first < 1) return null;
  return { index: y - first, name: m[3], start: m[1].length, current: "●◉⬤⏺•⦿".includes(m[2]) };
}
