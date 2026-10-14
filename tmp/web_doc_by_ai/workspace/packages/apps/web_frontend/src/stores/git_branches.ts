// The local Git branches of the selected workspace, for the branch picker of the status bar, and the checkout of one
// of them. The checkout reads the Git status again, so the status bar shows the new branch at once.
// - issue #350
import { invoke } from "@tauri-apps/api/core";
import { git, refreshGit } from "./git";
import { state as session, toast } from "./session";

/** One local Git branch, as the Tauri command `git_branches` gives it. */
export interface GitBranch {
  /** The name of the branch. */
  name: string;
  /** True for the branch that is checked out. */
  is_current: boolean;
  /** The short hash of the last commit of the branch. */
  last_sha: string;
  /** The subject of the last commit of the branch. */
  last_subject: string;
  /** The author of the last commit of the branch. */
  last_author: string;
  /** The time of the last commit of the branch, in seconds since 1970. */
  last_time: number;
  /** True when this computer knows a branch of the same name on the remote repository `origin`. */
  has_remote_tracking: boolean;
}

/** The root folder of the Git repository of the selected workspace, or null when there is none. */
export function selectedRoot(): string | null {
  const workspaceId = session.selectedWorkspaceId;
  if (workspaceId === null) {
    return null;
  }
  return git.status[workspaceId]?.root ?? null;
}

/**
 * Lists the local branches of the Git repository of the selected workspace, the most recently committed first.
 *
 * @returns The branches. An empty list when the selected workspace has no Git repository, or when Git fails.
 */
export async function listGitBranches(): Promise<GitBranch[]> {
  const root = selectedRoot();
  if (root === null) {
    return [];
  }
  try {
    return await invoke<GitBranch[]>("git_branches", { root });
  } catch (error) {
    toast(String(error).split("\n").slice(0, 4).join("\n"), "error");
    return [];
  }
}

/**
 * Checks out a local branch in the Git repository of the selected workspace. When Git refuses, for example because
 * an uncommitted change would be overwritten, a message shows the text of Git and the current branch does not change.
 *
 * @param branchName - The name of the local branch to check out.
 * @returns True when the checkout worked.
 */
export async function checkoutGitBranch(branchName: string): Promise<boolean> {
  const workspaceId = session.selectedWorkspaceId;
  const root = selectedRoot();
  if (workspaceId === null || root === null) {
    return false;
  }
  try {
    await invoke("git_checkout", { root, branch: branchName });
    return true;
  } catch (error) {
    toast(String(error).split("\n").slice(0, 4).join("\n"), "error");
    return false;
  } finally {
    await refreshGit(workspaceId);
  }
}

/**
 * Keeps the branches whose name, last commit subject, last commit author, or last commit hash contains the text,
 * without caring about the case.
 *
 * @param branches - The branches to filter.
 * @param query - The text that the developer typed. An empty text keeps every branch.
 * @returns The matching branches, in the same order.
 */
export function filterGitBranches(branches: GitBranch[], query: string): GitBranch[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) {
    return branches;
  }
  return branches.filter((branch) => {
    const haystack = `${branch.name} ${branch.last_subject} ${branch.last_author} ${branch.last_sha}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
