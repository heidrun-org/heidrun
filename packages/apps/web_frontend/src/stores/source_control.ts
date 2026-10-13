// The Source control sidebar section: the files of the two groups "Staged Changes" and "Changes", and the Git
// actions on them (stage, unstage, discard, commit, stash, pull, push, fetch). Each action reads the Git status again.
// - issue #305
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { git, refreshGit, type GitStatus } from "./git";
import { askConfirm } from "./confirm";
import { state as session, toast } from "./session";
import { t } from "../i18n/index";

/** The two groups of files of the Source control sidebar section. */
export type SourceControlGroup = "staged" | "changes";

/** One file line of the Source control sidebar section. */
export interface SourceControlFile {
  /** The path of the file, from the root of the repository. */
  path: string;
  /** The name of the file, without its folders. */
  name: string;
  /** The folders of the file, or an empty text for a file at the root of the repository. */
  folder: string;
  /**
   * The status letter that VS Code shows: "M" modified, "A" added, "D" deleted, "R" renamed, "C" copied, "T" type
   * changed, "U" untracked, "!" in conflict.
   */
  letter: string;
}

/** What the commit button does: commit, commit then push, or replace the last commit. */
export type CommitMode = "commit" | "commitAndPush" | "amend";

/** A Git action that talks to the remote repository. */
export type SyncAction = "pull" | "push" | "fetch";

/** What the Tauri command `coding_agent_ask` gives. */
interface CodingAgentAnswer {
  agent: string;
  text: string;
}

/** The state of the Source control sidebar section. */
export const sourceControl = reactive({
  /** The commit message being written, by workspace id. */
  messages: {} as Record<string, string>,
  /** True while a Git action runs. The buttons wait for it. */
  isBusy: false,
  /** True while a coding agent writes the commit message. */
  isWritingMessage: false,
  /** The groups that are folded. */
  folded: { staged: false, changes: false } as Record<SourceControlGroup, boolean>,
});

/** The status letters of the index and of the working folder that mean a conflict. */
const CONFLICT_PAIRS = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

/**
 * Splits the files of the Git status into the two groups. The status is the pair "XY" of `git status --porcelain=v2`:
 * X is the index ("Staged Changes"), Y is the working folder ("Changes"), and "." means no change. A file can be in the
 * two groups. A new file that Git does not know ("??") and a file in conflict are in "Changes".
 */
export function splitFiles(status: GitStatus | null): Record<SourceControlGroup, SourceControlFile[]> {
  const groups: Record<SourceControlGroup, SourceControlFile[]> = { staged: [], changes: [] };
  if (status === null) {
    return groups;
  }
  for (const file of status.files) {
    if (file.status === "??") {
      groups.changes.push(makeFile(file.path, "U"));
      continue;
    }
    if (CONFLICT_PAIRS.has(file.status)) {
      groups.changes.push(makeFile(file.path, "!"));
      continue;
    }
    const indexLetter = file.status[0] ?? ".";
    const workingFolderLetter = file.status[1] ?? ".";
    if (indexLetter !== ".") {
      groups.staged.push(makeFile(file.path, indexLetter));
    }
    if (workingFolderLetter !== ".") {
      groups.changes.push(makeFile(file.path, workingFolderLetter));
    }
  }
  return groups;
}

/** Stages the files `paths`. */
export async function stageFiles(paths: string[]): Promise<void> {
  await runOnRoot("git_stage", (root) => ({ root, paths }));
}

/** Unstages the files `paths`. */
export async function unstageFiles(paths: string[]): Promise<void> {
  await runOnRoot("git_unstage", (root) => ({ root, paths }));
}

/** Discards the changes of the files `paths`, after the user confirms it. The changes cannot come back. */
export async function discardFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  const title =
    paths.length === 1
      ? t("sourceControlPanel.discardOneQuestion", { path: paths[0] })
      : t("sourceControlPanel.discardManyQuestion", { count: paths.length });
  const isConfirmed = await askConfirm(title, t("sourceControlPanel.discardConfirm"));
  if (isConfirmed === false) {
    return;
  }
  await runOnRoot("git_discard", (root) => ({ root, paths }));
}

/** Puts the changes aside with `git stash`: the staged files only when `isStagedOnly`. */
export async function stashChanges(isStagedOnly: boolean): Promise<void> {
  const result = await runOnRoot("git_stash", (root) => ({ root, stagedOnly: isStagedOnly }));
  if (result.isDone) {
    toast(t("sourceControlPanel.stashed"));
  }
}

/** Runs `git pull`, `git push`, or `git fetch`. */
export async function syncRepository(action: SyncAction): Promise<void> {
  const result = await runOnRoot("git_sync", (root) => ({ root, action }));
  if (result.isDone) {
    toast(t(`sourceControlPanel.synced.${action}`));
  }
}

/**
 * Makes a commit with the message of the selected workspace. When no file is staged, the user is asked whether to
 * stage every change and commit it, as VS Code asks. The message box is emptied after the commit.
 */
export async function commit(mode: CommitMode): Promise<void> {
  const workspaceId = session.selectedWorkspaceId;
  if (workspaceId === null) {
    return;
  }
  const status = git.status[workspaceId] ?? null;
  const message = (sourceControl.messages[workspaceId] ?? "").trim();
  if (status === null) {
    return;
  }
  if (message === "") {
    toast(t("sourceControlPanel.emptyMessage"));
    return;
  }
  const groups = splitFiles(status);
  if (mode !== "amend" && groups.staged.length === 0) {
    if (groups.changes.length === 0) {
      toast(t("sourceControlPanel.nothingToCommit"));
      return;
    }
    const isConfirmed = await askConfirm(t("sourceControlPanel.stageAllQuestion"), t("sourceControlPanel.stageAllConfirm"));
    if (isConfirmed === false) {
      return;
    }
    const stageResult = await runOnRoot("git_stage", (root) => ({ root, paths: groups.changes.map((file) => file.path) }));
    if (stageResult.isDone === false) {
      return;
    }
  }
  const commitResult = await runOnRoot("git_commit", (root) => ({ root, message, amend: mode === "amend" }));
  if (commitResult.isDone === false) {
    return;
  }
  sourceControl.messages[workspaceId] = "";
  if (mode === "commitAndPush") {
    await syncRepository("push");
  }
}

/** Asks a coding agent to write the commit message from the diff, and puts the message in the message box. */
export async function writeCommitMessage(): Promise<void> {
  const workspaceId = session.selectedWorkspaceId;
  if (workspaceId === null || sourceControl.isWritingMessage) {
    return;
  }
  const root = git.status[workspaceId]?.root;
  if (root === undefined) {
    return;
  }
  sourceControl.isWritingMessage = true;
  try {
    const diff = await invoke<string>("git_commit_diff", { root });
    if (diff.trim() === "") {
      toast(t("sourceControlPanel.nothingToCommit"));
      return;
    }
    const answer = await invoke<CodingAgentAnswer>("coding_agent_ask", { prompt: t("sourceControlPanel.messagePrompt", { diff }) });
    sourceControl.messages[workspaceId] = answer.text.trim();
  } catch (error) {
    const text = String(error);
    toast(text === "no_coding_agent" ? t("sourceControlPanel.noCodingAgent") : text);
  } finally {
    sourceControl.isWritingMessage = false;
  }
}

/** Makes one file line from a path and its status letter. */
function makeFile(path: string, letter: string): SourceControlFile {
  const slash = path.lastIndexOf("/");
  return {
    path,
    name: slash === -1 ? path : path.slice(slash + 1),
    folder: slash === -1 ? "" : path.slice(0, slash),
    letter,
  };
}

/**
 * Runs the Tauri command `command` on the root of the repository of the selected workspace, then reads the Git status
 * again. `isDone` is false when there is no repository or when the command fails. A failure shows its reason in a
 * message.
 */
async function runOnRoot(command: string, makeArguments: (root: string) => Record<string, unknown>): Promise<{ isDone: boolean }> {
  const workspaceId = session.selectedWorkspaceId;
  if (workspaceId === null) {
    return { isDone: false };
  }
  const root = git.status[workspaceId]?.root;
  if (root === undefined) {
    return { isDone: false };
  }
  sourceControl.isBusy = true;
  try {
    await invoke(command, makeArguments(root));
    return { isDone: true };
  } catch (error) {
    toast(String(error).split("\n").slice(0, 4).join("\n"));
    return { isDone: false };
  } finally {
    sourceControl.isBusy = false;
    await refreshGit(workspaceId);
  }
}
