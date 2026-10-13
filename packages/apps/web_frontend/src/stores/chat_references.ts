// What the forge says about the issues and the pull requests that a chat mentions: the title, the state, the description,
// the labels, the person who opened it, the date, and the branches. It is read with `gh` or `glab` through the Tauri
// command `forge_cli_cached`, which keeps each answer on the disk for ten minutes.
import { invoke } from "@tauri-apps/api/core";
import type { ChatReference } from "../lib/chat_references";
import type { Forge } from "../lib/refs";

/** A label of an issue or of a pull request. */
export type ChatReferenceLabel = {
  /** The name of the label. */
  name: string;
  /** The color of the label as six hexadecimal digits without `#`, or null when the forge gives no color. */
  color: string | null;
};

/** What the forge says about an issue or a pull request. */
export type ChatReferenceDetails = {
  /** The title. */
  title: string;
  /** The state in lower case, as the forge says it, for example "open", "closed", or "merged". */
  rawState: string;
  /** The description in Markdown. */
  body: string;
  /** The labels. */
  labels: ChatReferenceLabel[];
  /** The login of the person who opened it, or null. */
  author: string | null;
  /** The address of the picture of the person who opened it, or null when it is not known. */
  authorAvatarUrl: string | null;
  /** The date of the creation, in milliseconds since 1970, or null. */
  createdAt: number | null;
  /** The branch that holds the changes of a pull request, or null for an issue. */
  headBranch: string | null;
  /** The branch that receives the changes of a pull request, or null for an issue. */
  baseBranch: string | null;
};

/**
 * The details of an issue or of a pull request.
 * @param folder - the folder of the workspace, where `gh` or `glab` runs
 * @param forge - the forge of the repository
 * @param reference - the issue or the pull request
 * @returns the details, or null when the forge does not answer
 */
export async function loadChatReferenceDetails(
  folder: string,
  forge: Forge,
  reference: ChatReference,
): Promise<ChatReferenceDetails | null> {
  try {
    return forge === "github" ? await readGithub(folder, reference) : await readGitlab(folder, reference);
  } catch {
    return null;
  }
}

/** The time of a date in the text that a forge gives, in milliseconds since 1970, or null. */
function timeOf(text: string | undefined | null): number | null {
  return text === undefined || text === null ? null : Date.parse(text) || null;
}

/**
 * The address of the picture of a person on GitHub. `gh` gives the login only, and GitHub gives the picture of a person
 * at `https://github.com/<login>.png`.
 * @param login - the login of the person, or nothing
 * @returns the address, or null when there is no login or the login is not a login of a person (for example "app/name")
 */
function githubAvatarUrl(login: string | undefined): string | null {
  if (login === undefined || /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(login) === false) {
    return null;
  }
  return `https://github.com/${login}.png?size=48`;
}

/** The details of an issue or of a pull request, read with `gh`. */
async function readGithub(folder: string, reference: ChatReference): Promise<ChatReferenceDetails> {
  const isIssue = reference.kind === "issue";
  const fields = isIssue
    ? "title,state,body,labels,author,createdAt"
    : "title,state,body,labels,author,createdAt,headRefName,baseRefName";
  const args = [isIssue ? "issue" : "pr", "view", String(reference.number), "--json", fields];
  const answer = JSON.parse(await invoke<string>("forge_cli_cached", { cwd: folder, tool: "gh", args })) as {
    title: string;
    state: string;
    body?: string;
    labels?: { name: string; color?: string }[];
    author?: { login?: string };
    createdAt?: string;
    headRefName?: string;
    baseRefName?: string;
  };
  return {
    title: answer.title,
    rawState: answer.state.toLowerCase(),
    body: answer.body ?? "",
    labels: (answer.labels ?? []).map((label) => ({ name: label.name, color: label.color ?? null })),
    author: answer.author?.login ?? null,
    authorAvatarUrl: githubAvatarUrl(answer.author?.login),
    createdAt: timeOf(answer.createdAt),
    headBranch: answer.headRefName ?? null,
    baseBranch: answer.baseRefName ?? null,
  };
}

/** The details of an issue or of a merge request, read with `glab`. */
async function readGitlab(folder: string, reference: ChatReference): Promise<ChatReferenceDetails> {
  const kind = reference.kind === "issue" ? "issues" : "merge_requests";
  const args = ["api", `projects/:fullpath/${kind}/${reference.number}`];
  const answer = JSON.parse(await invoke<string>("forge_cli_cached", { cwd: folder, tool: "glab", args })) as {
    title: string;
    state: string;
    description?: string | null;
    labels?: string[];
    author?: { username?: string; avatar_url?: string };
    created_at?: string;
    source_branch?: string;
    target_branch?: string;
  };
  return {
    title: answer.title,
    rawState: answer.state === "opened" ? "open" : answer.state,
    body: answer.description ?? "",
    labels: (answer.labels ?? []).map((name) => ({ name, color: null })),
    author: answer.author?.username ?? null,
    authorAvatarUrl: /^https?:\/\//.test(answer.author?.avatar_url ?? "") ? (answer.author?.avatar_url ?? null) : null,
    createdAt: timeOf(answer.created_at),
    headBranch: answer.source_branch ?? null,
    baseBranch: answer.target_branch ?? null,
  };
}
