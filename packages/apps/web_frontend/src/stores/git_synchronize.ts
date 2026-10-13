// The synchronization of the current Git branch with its upstream branch, started from the turning-arrows icon of the
// status bar, as "Synchronize Changes" of Visual Studio Code does: the upstream branch is fetched, then merged into the
// current branch, then the commits that the upstream branch does not have are pushed. A merge in conflict pushes nothing.
// - issue #348
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { git, refreshGit } from "./git";
import { state as session } from "./session";

/** What the Tauri command `git_synchronize` gives. */
export interface SynchronizeResult {
  /** `merged` when new commits came in, `up_to_date` when there was nothing to merge, `conflict` when Git stopped. */
  outcome: "merged" | "up_to_date" | "conflict";
  /** The upstream branch that was merged, for example `origin/main`. */
  upstream: string;
  /** The files in conflict. Empty unless the outcome is `conflict`. */
  conflicts: string[];
  /** The number of commits sent to the upstream branch after the merge. */
  pushed: number;
  /** The message of Git when the commits could not be sent. The merge is done in this case. */
  push_error: string | null;
}

/** The state of the synchronization with the upstream branch, shown in the information card of the turning-arrows icon. */
export const synchronize = reactive({
  /** True while the upstream branch is fetched, merged, and pushed. A second synchronization cannot start during this time. */
  isBusy: false,
  /** The result of the last synchronization, or null before the first one and while one runs. */
  result: null as SynchronizeResult | null,
  /** The message of Git when the last synchronization failed before the push, or null. */
  error: null as string | null,
});

/**
 * Fetches the upstream branch of the current branch of the selected workspace, merges it into the current branch, pushes
 * the commits that the upstream branch does not have, and reads the Git status again. The result, or the message of Git
 * when it fails before the push, is in `synchronize`.
 *
 * @returns A promise that ends when the synchronization is over.
 */
export async function runSynchronize(): Promise<void> {
  const workspaceId = session.selectedWorkspaceId;
  const root = workspaceId === null ? undefined : git.status[workspaceId]?.root;
  if (workspaceId === null || root === undefined || synchronize.isBusy === true) {
    return;
  }
  synchronize.isBusy = true;
  synchronize.result = null;
  synchronize.error = null;
  try {
    synchronize.result = await invoke<SynchronizeResult>("git_synchronize", { root });
  } catch (error) {
    synchronize.error = String(error).split("\n").slice(0, 4).join("\n");
  } finally {
    synchronize.isBusy = false;
    await refreshGit(workspaceId);
  }
}
