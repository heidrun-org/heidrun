/** A worktree that a coding agent worked in during a chat. */
export type ChatWorktree = {
  /** The name of the worktree: the folder after `.claude/worktrees/` (Claude) or after `.codex/worktrees/` (Codex). */
  name: string;
  /** The absolute path of the folder of the worktree. For Codex, it ends with the folder of the repository. */
  folder: string;
};

/** The most worktree names that the summary of a chat writes. The others count as "+N". */
export const LISTED_WORKTREES = 2;

/**
 * Where each coding agent makes its worktrees. `parts` is the number of folders that follow the marker in the folder of the
 * worktree: Claude makes `.claude/worktrees/<name>`, and Codex makes `.codex/worktrees/<name>/<folder of the repository>`.
 */
const WORKTREE_PLACES = [
  { marker: "/.claude/worktrees/", parts: 1 },
  { marker: "/.codex/worktrees/", parts: 2 },
];

/**
 * The worktree that a path is in.
 * @param path - the absolute path of a folder or of a file
 * @returns the worktree, or null when the path is not in a worktree of Claude or of Codex
 */
export function worktreeOfPath(path: string): ChatWorktree | null {
  for (const place of WORKTREE_PLACES) {
    const at = path.indexOf(place.marker);
    if (at < 0) {
      continue;
    }
    const start = at + place.marker.length;
    const parts = path.slice(start).split("/");
    const name = parts[0];
    if (name === "") {
      continue;
    }
    const kept = parts.slice(0, place.parts).filter((part) => part !== "");
    return { name, folder: path.slice(0, start) + kept.join("/") };
  }
  return null;
}

/**
 * The worktrees that a chat worked in, each name once. The main checkout is not a worktree, so it never shows.
 * @param folders - the folders where the coding agent ran
 * @param paths - the absolute paths of the files that the coding agent wrote
 * @returns one entry for each different name, in the order of the first folder or path that names it
 */
export function chatWorktrees(folders: string[], paths: string[]): ChatWorktree[] {
  const seen = new Set<string>();
  const worktrees: ChatWorktree[] = [];
  for (const path of [...folders, ...paths]) {
    const worktree = worktreeOfPath(path);
    if (worktree === null || seen.has(worktree.name)) {
      continue;
    }
    seen.add(worktree.name);
    worktrees.push(worktree);
  }
  return worktrees;
}

/**
 * The worktrees that the summary names, and how many more there are.
 * @param worktrees - the worktrees of a chat
 * @returns the first worktrees, and the number of the others
 */
export function listedWorktrees(worktrees: ChatWorktree[]): { listed: ChatWorktree[]; more: number } {
  const listed = worktrees.slice(0, LISTED_WORKTREES);
  return { listed, more: worktrees.length - listed.length };
}

/** The names of the first worktrees, then how many more there are: "fix-tab-35, c41f, +1". */
export function worktreesText(worktrees: ChatWorktree[]): string {
  const { listed, more } = listedWorktrees(worktrees);
  const names = listed.map((worktree) => worktree.name).join(", ");
  return more > 0 ? `${names}, +${more}` : names;
}
