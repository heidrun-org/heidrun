// The names of the branches that the remote repository has, for the link of each row of the branch picker: the link is
// disabled for a branch that is only local. Asking the remote repository needs the network, so the answer is kept for one
// day, in memory and in the local storage of the web view, so it survives a restart of the application.
// - issue #350
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";

/** How long an answer of the remote repository stays valid: one day, in milliseconds. */
export const REMOTE_BRANCHES_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** The key of the local storage. */
const STORAGE_KEY = "heidrun.gitRemoteBranches";

/** One answer of the remote repository. */
interface RemoteBranchesEntry {
  /** When the remote repository answered, in milliseconds since 1970. */
  at: number;
  /** The names of the branches of the remote repository. */
  names: string[];
}

/** The names of the remote branches that are known now, by root folder of the Git repository. */
export const remoteBranches = reactive({ namesByRoot: {} as Record<string, string[]> });

/** The requests that are running, by root folder, so two openings of the picker ask the remote repository once. */
const runningRequests = new Map<string, Promise<void>>();

/** Reads the answers kept in the local storage. An unreadable storage gives an empty list. */
function readStorage(): Record<string, RemoteBranchesEntry> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, RemoteBranchesEntry>) : {};
  } catch {
    return {};
  }
}

/** Writes one answer in the local storage. A storage that refuses the write is ignored: the memory keeps the answer. */
function writeStorage(root: string, entry: RemoteBranchesEntry): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStorage(), [root]: entry }));
  } catch {
    // The answer stays in memory only.
  }
}

/** True when the entry has the right shape and is younger than one day. */
function isFresh(entry: RemoteBranchesEntry | undefined, now: number): entry is RemoteBranchesEntry {
  return entry !== undefined && Array.isArray(entry.names) && typeof entry.at === "number" && now - entry.at < REMOTE_BRANCHES_LIFETIME_MS;
}

/**
 * Makes the names of the remote branches known for a repository. A answer that is less than one day old is used as it is.
 * Otherwise the remote repository is asked. When it cannot answer, for example without network, an older answer is used
 * if there is one, and nothing becomes known if there is none.
 *
 * @param root - The root folder of the Git repository.
 * @param now - The current time in milliseconds since 1970. Tests give it.
 * @returns A promise that ends when the names are known, or when the remote repository could not answer.
 */
export function loadRemoteBranchNames(root: string, now: number = Date.now()): Promise<void> {
  const running = runningRequests.get(root);
  if (running !== undefined) {
    return running;
  }
  const kept = readStorage()[root];
  if (isFresh(kept, now)) {
    remoteBranches.namesByRoot[root] = kept.names;
    return Promise.resolve();
  }
  const request = askRemote(root, now, kept).finally(() => runningRequests.delete(root));
  runningRequests.set(root, request);
  return request;
}

/** Asks the remote repository, keeps the answer, and falls back to the older answer when the question fails. */
async function askRemote(root: string, now: number, older: RemoteBranchesEntry | undefined): Promise<void> {
  try {
    const names = await invoke<string[]>("git_remote_branches", { root });
    remoteBranches.namesByRoot[root] = names;
    writeStorage(root, { at: now, names });
  } catch {
    if (older !== undefined && Array.isArray(older.names)) {
      remoteBranches.namesByRoot[root] = older.names;
    }
  }
}

/**
 * Tells if the page of a branch on the forge can exist. It is true when this computer knows a remote-tracking branch,
 * and when the remote repository listed the branch. It is also true while nothing is known, so the link is not disabled
 * by mistake before the answer arrives.
 *
 * @param root - The root folder of the Git repository.
 * @param branchName - The name of the local branch.
 * @param hasRemoteTracking - True when the local repository has a remote-tracking branch of this name.
 * @returns False only when the branch is known to be only local.
 */
export function isOnRemote(root: string | null, branchName: string, hasRemoteTracking: boolean): boolean {
  if (hasRemoteTracking === true) {
    return true;
  }
  const names = root === null ? undefined : remoteBranches.namesByRoot[root];
  return names === undefined || names.includes(branchName);
}
