// The merge of the current Git branch with its upstream branch, started from the turning-arrows icon of the status bar:
// the upstream branch is fetched, then merged into the current branch. Nothing is pushed.
// - issue #348
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { git, refreshGit } from "./git";
import { state as session } from "./session";

/** What the Tauri command `git_merge_upstream` gives. */
export interface MergeUpstreamResult {
  /** `merged` when new commits came in, `up_to_date` when there was nothing to merge, `conflict` when Git stopped. */
  outcome: "merged" | "up_to_date" | "conflict";
  /** The upstream branch that was merged, for example `origin/main`. */
  upstream: string;
  /** The files in conflict. Empty unless the outcome is `conflict`. */
  conflicts: string[];
}

/** The state of the merge with the upstream branch, shown in the information card of the turning-arrows icon. */
export const mergeUpstream = reactive({
  /** True while the upstream branch is fetched and merged. A second merge cannot start during this time. */
  isBusy: false,
  /** The result of the last merge, or null before the first merge and while a merge runs. */
  result: null as MergeUpstreamResult | null,
  /** The message of Git when the last merge failed, or null. */
  error: null as string | null,
});

/**
 * Fetches the upstream branch of the current branch of the selected workspace, merges it into the current branch, and
 * reads the Git status again. The result, or the message of Git when the merge fails, is in `mergeUpstream`.
 *
 * @returns A promise that ends when the merge is over.
 */
export async function runMergeUpstream(): Promise<void> {
  const workspaceId = session.selectedWorkspaceId;
  const root = workspaceId === null ? undefined : git.status[workspaceId]?.root;
  if (workspaceId === null || root === undefined || mergeUpstream.isBusy === true) {
    return;
  }
  mergeUpstream.isBusy = true;
  mergeUpstream.result = null;
  mergeUpstream.error = null;
  try {
    mergeUpstream.result = await invoke<MergeUpstreamResult>("git_merge_upstream", { root });
  } catch (error) {
    mergeUpstream.error = String(error).split("\n").slice(0, 4).join("\n");
  } finally {
    mergeUpstream.isBusy = false;
    await refreshGit(workspaceId);
  }
}
