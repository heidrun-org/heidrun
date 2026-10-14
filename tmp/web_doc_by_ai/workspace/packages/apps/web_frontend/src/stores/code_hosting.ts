// The Code hosting sidebar section: the open issues, and the open pull requests (GitHub) or merge requests (GitLab), of
// the repository of the selected workspace. They are read with `gh` or `glab` through the Tauri command
// `forge_cli_cached`, which keeps each answer on the disk for ten minutes. A refresh asks the hosting service again.
// A search filters the two lists: `gh` takes it as it is, and for GitLab it is translated into filters.
// - issue #370
// - issue #374
// - issue #378
import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../i18n/index";
import {
  githubSearchArguments,
  githubState,
  translateForGitlab,
  usesCurrentUser,
  type GitlabTranslation,
} from "../lib/code_hosting_search";
import { refContext, type Forge, type RefContext } from "../lib/refs";
import type { ChatReferenceLabel } from "./chat_references";

/** The most items that one list reads from GitHub or GitLab. A list that reaches it may hold more items. */
export const CODE_HOSTING_LIMIT = 100;

/** The two lists of the Code hosting sidebar section: the issues, and the pull requests or merge requests. */
export type CodeHostingGroup = "issues" | "requests";

/** One row of a list: one issue, one pull request, or one merge request. */
export type CodeHostingItem = {
  /** The number of the item on GitHub or GitLab. */
  number: number;
  /** The title of the item. */
  title: string;
  /** The address of the web page of the item. */
  url: string;
  /** The login of the person who opened the item, or null. */
  author: string | null;
  /** The date of the creation, in milliseconds since 1970, or null. */
  createdAt: number | null;
  /** The labels of an issue, with their colors. A pull request or a merge request has none here. */
  labels: ChatReferenceLabel[];
  /** True for a draft pull request or a draft merge request. */
  isDraft: boolean;
  /** The branch that holds the changes of a pull request or of a merge request, or null for an issue. */
  headBranch: string | null;
  /** The branch that receives the changes of a pull request or of a merge request, or null for an issue. */
  baseBranch: string | null;
};

/** What the sidebar section shows: "idle" before the first load, "noRemote" for a repository without a remote address. */
export type CodeHostingStatus = "idle" | "loading" | "ready" | "noRemote" | "failed";

/** The state of the Code hosting sidebar section. */
export const codeHosting = reactive({
  /** The open issues. */
  issues: [] as CodeHostingItem[],
  /** The open pull requests (GitHub) or merge requests (GitLab). */
  requests: [] as CodeHostingItem[],
  /** The hosting service of the repository, or null when it is not known yet. */
  forge: null as Forge | null,
  /** The address of the repository on its hosting service, or null when it is not known yet. */
  webBase: null as string | null,
  /** The search that the two lists show the result of, in the search language of GitHub. Empty: no search. */
  search: "",
  /** What the sidebar section shows. */
  status: "idle" as CodeHostingStatus,
  /** The first line of the failure of `gh` or `glab`, or an empty text. */
  error: "",
  /** The lists that are folded. */
  folded: { issues: false, requests: false } as Record<CodeHostingGroup, boolean>,
});

/**
 * The hosting service of a repository, from its remote address. A host that is not GitHub is read as GitLab, as
 * everywhere else.
 * @param context - the context of the folder of the repository
 * @returns the hosting service, or null when the repository has no remote address
 */
export function forgeOfContext(context: RefContext): Forge | null {
  if (context.base === null) {
    return null;
  }
  return context.forge ?? "gitlab";
}

/**
 * Reads the hosting service of the repository of a folder, for the icon of the Code hosting sidebar section. It reads
 * the remote address only: no call to `gh` or `glab`, and no network call.
 * @param folder - the root folder of the Git repository of the selected workspace, or null when there is none
 * @returns the hosting service, or null when it is not known
 */
export async function readCodeHostingForge(folder: string | null): Promise<Forge | null> {
  if (folder === null) {
    return null;
  }
  try {
    return forgeOfContext(await refContext(folder));
  } catch {
    return null;
  }
}

/** The number of the last load: an older load that ends later does not replace the lists. */
let lastLoad = 0;

/** The failure of a search that GitLab cannot do. Its message is shown as it is, and says the word. */
class CodeHostingSearchError extends Error {}

/** What `gh issue list` and `gh pr list` print for one item. */
type GithubItem = {
  number: number;
  title: string;
  url: string;
  author?: { login?: string } | null;
  createdAt?: string;
  labels?: { name: string; color?: string }[];
  isDraft?: boolean;
  headRefName?: string;
  baseRefName?: string;
};

/** What the API of GitLab gives for one issue or one merge request. */
type GitlabItem = {
  iid: number;
  title: string;
  web_url: string;
  author?: { username?: string } | null;
  created_at?: string;
  labels?: (string | { name: string; color?: string })[];
  draft?: boolean;
  source_branch?: string;
  target_branch?: string;
};

/** The fields that `gh issue list` prints for each issue. */
const GITHUB_ISSUE_FIELDS = "number,title,url,author,createdAt,labels";

/** The fields that `gh pr list` prints for each pull request. */
const GITHUB_PULL_REQUEST_FIELDS = "number,title,url,author,createdAt,isDraft,headRefName,baseRefName";

/**
 * The time of a date in the text that a hosting service gives.
 * @param text - the date, or nothing
 * @returns the time in milliseconds since 1970, or null
 */
function timeOf(text: string | undefined): number | null {
  return text === undefined ? null : Date.parse(text) || null;
}

/**
 * The row of an item that `gh` printed.
 * @param item - the item
 * @returns the row
 */
function itemOfGithub(item: GithubItem): CodeHostingItem {
  return {
    number: item.number,
    title: item.title,
    url: item.url,
    author: item.author?.login ?? null,
    createdAt: timeOf(item.createdAt),
    labels: (item.labels ?? []).map((label) => ({ name: label.name, color: label.color ?? null })),
    isDraft: item.isDraft === true,
    headBranch: item.headRefName ?? null,
    baseBranch: item.baseRefName ?? null,
  };
}

/**
 * The label that the API of GitLab gave. With the parameter `with_labels_details`, a label is an object with its color
 * as `#rrggbb`. Without it, a label is its name.
 * @param label - the name of the label, or the label with its details
 * @returns the label, with the color as six hexadecimal digits without `#`
 */
function labelOfGitlab(label: string | { name: string; color?: string }): ChatReferenceLabel {
  if (typeof label === "string") {
    return { name: label, color: null };
  }
  return { name: label.name, color: label.color === undefined ? null : label.color.replace(/^#/, "") };
}

/**
 * The row of an item that the API of GitLab gave.
 * @param item - the item
 * @returns the row
 */
function itemOfGitlab(item: GitlabItem): CodeHostingItem {
  return {
    number: item.iid,
    title: item.title,
    url: item.web_url,
    author: item.author?.username ?? null,
    createdAt: timeOf(item.created_at),
    labels: (item.labels ?? []).map(labelOfGitlab),
    isDraft: item.draft === true,
    headBranch: item.source_branch ?? null,
    baseBranch: item.target_branch ?? null,
  };
}

/**
 * Runs `gh` or `glab` in a folder of the repository, through the cache of the answers.
 * @param folder - the folder of the repository
 * @param tool - the command line tool of the hosting service
 * @param args - the arguments of the tool
 * @param isRefresh - true to ask the hosting service again even when a fresh answer is kept
 * @returns what the tool printed
 */
function runForge(folder: string, tool: "gh" | "glab", args: string[], isRefresh: boolean): Promise<string> {
  return invoke<string>("forge_cli_cached", { cwd: folder, tool, args, refresh: isRefresh });
}

/**
 * Reads the open issues and the open pull requests of a repository on GitHub. A search goes to `gh` as it is.
 * @param folder - the folder of the repository
 * @param isRefresh - true to ask GitHub again even when a fresh answer is kept
 * @param search - the search, or an empty text for no search
 * @returns the two lists
 */
async function readGithub(
  folder: string,
  isRefresh: boolean,
  search: string,
): Promise<{ issues: CodeHostingItem[]; requests: CodeHostingItem[] }> {
  const common = [
    "--state",
    githubState(search),
    "--limit",
    String(CODE_HOSTING_LIMIT),
    ...githubSearchArguments(search),
    "--json",
  ];
  const [issuesAnswer, requestsAnswer] = await Promise.all([
    runForge(folder, "gh", ["issue", "list", ...common, GITHUB_ISSUE_FIELDS], isRefresh),
    runForge(folder, "gh", ["pr", "list", ...common, GITHUB_PULL_REQUEST_FIELDS], isRefresh),
  ]);
  return {
    issues: (JSON.parse(issuesAnswer) as GithubItem[]).map(itemOfGithub),
    requests: (JSON.parse(requestsAnswer) as GithubItem[]).map(itemOfGithub),
  };
}

/**
 * Reads the login of the person who is signed in to `glab`.
 * @param folder - the folder of the repository
 * @param isRefresh - true to ask GitLab again even when a fresh answer is kept
 * @returns the login
 */
async function readGitlabLogin(folder: string, isRefresh: boolean): Promise<string> {
  const user = JSON.parse(await runForge(folder, "glab", ["api", "user"], isRefresh)) as { username?: string };
  if (user.username === undefined) {
    throw new Error("glab api user: no username");
  }
  return user.username;
}

/**
 * Reads one list of a repository on GitLab.
 * @param folder - the folder of the repository
 * @param isRefresh - true to ask GitLab again even when a fresh answer is kept
 * @param path - the part of the address after the project: "issues" or "merge_requests"
 * @param translation - the filters of the search for this list
 * @returns the items, none when the search leaves nothing in this list
 */
async function readGitlabList(
  folder: string,
  isRefresh: boolean,
  path: "issues" | "merge_requests",
  translation: GitlabTranslation,
): Promise<CodeHostingItem[]> {
  if (translation.kind !== "filters") {
    return [];
  }
  const parameters = [...translation.parameters, `per_page=${CODE_HOSTING_LIMIT}`];
  if (path === "issues") {
    parameters.push("with_labels_details=true");
  }
  const answer = await runForge(folder, "glab", ["api", `projects/:fullpath/${path}?${parameters.join("&")}`], isRefresh);
  return (JSON.parse(answer) as GitlabItem[]).map(itemOfGitlab);
}

/**
 * Translates a search into the filters of GitLab for the two lists.
 * @param search - the search
 * @param login - the login of the person who is signed in, for `@me`, or null when it is not known
 * @returns the translation for the issues, and the translation for the merge requests
 */
function translateBoth(search: string, login: string | null): Record<CodeHostingGroup, GitlabTranslation> {
  return { issues: translateForGitlab("issues", search, login), requests: translateForGitlab("requests", search, login) };
}

/**
 * Reads the open issues and the open merge requests of a repository on GitLab. GitLab has no search language, so the
 * search is translated into filters. A word that GitLab cannot do stops the reading, with a message that names it.
 * @param folder - the folder of the repository
 * @param isRefresh - true to ask GitLab again even when a fresh answer is kept
 * @param search - the search, or an empty text for no search
 * @returns the two lists
 */
async function readGitlab(
  folder: string,
  isRefresh: boolean,
  search: string,
): Promise<{ issues: CodeHostingItem[]; requests: CodeHostingItem[] }> {
  // A first translation with a made-up login finds a word that GitLab cannot do before `glab` is asked for the login.
  const firstTranslation = translateBoth(search, "login");
  for (const translation of [firstTranslation.issues, firstTranslation.requests]) {
    if (translation.kind === "cannot") {
      throw new CodeHostingSearchError(t("codeHostingPanel.gitlabCannot", { word: translation.word }));
    }
  }
  const login = usesCurrentUser(search) ? await readGitlabLogin(folder, isRefresh) : null;
  const { issues: issuesTranslation, requests: requestsTranslation } = translateBoth(search, login);
  const [issues, requests] = await Promise.all([
    readGitlabList(folder, isRefresh, "issues", issuesTranslation),
    readGitlabList(folder, isRefresh, "merge_requests", requestsTranslation),
  ]);
  return { issues, requests };
}

/**
 * Loads the two lists of the repository of a folder, filtered by the search `codeHosting.search`. The lists stay empty
 * and the status is "noRemote" when the repository has no remote address.
 * @param folder - the root folder of the Git repository of the selected workspace, or null when there is none
 * @param isRefresh - true after a click on "Refresh": the hosting service is asked again, and the cache is not used
 * @returns nothing
 */
export async function loadCodeHosting(folder: string | null, isRefresh = false): Promise<void> {
  const thisLoad = ++lastLoad;
  codeHosting.issues = [];
  codeHosting.requests = [];
  codeHosting.error = "";
  if (folder === null) {
    codeHosting.status = "idle";
    return;
  }
  codeHosting.status = "loading";
  try {
    const context = await refContext(folder);
    if (thisLoad !== lastLoad) {
      return;
    }
    const forge = forgeOfContext(context);
    if (forge === null || context.base === null) {
      codeHosting.forge = null;
      codeHosting.webBase = null;
      codeHosting.status = "noRemote";
      return;
    }
    const search = codeHosting.search;
    const lists =
      forge === "github" ? await readGithub(folder, isRefresh, search) : await readGitlab(folder, isRefresh, search);
    if (thisLoad !== lastLoad) {
      return;
    }
    codeHosting.forge = forge;
    codeHosting.webBase = context.base;
    codeHosting.issues = lists.issues;
    codeHosting.requests = lists.requests;
    codeHosting.status = "ready";
  } catch (failure) {
    if (thisLoad !== lastLoad) {
      return;
    }
    codeHosting.error =
      failure instanceof CodeHostingSearchError ? failure.message : String(failure).split("\n")[0].slice(0, 300);
    codeHosting.status = "failed";
  }
}

/**
 * Runs a search: the two lists show the items that match it. An empty search shows all the open items.
 * @param folder - the root folder of the Git repository of the selected workspace, or null when there is none
 * @param text - the search, in the search language of GitHub
 * @returns nothing
 */
export async function searchCodeHosting(folder: string | null, text: string): Promise<void> {
  codeHosting.search = text.trim();
  await loadCodeHosting(folder);
}

/**
 * The text before the number of an item: "#" for an issue and for a pull request, "!" for a merge request.
 * @param group - the list of the item
 * @param forge - the hosting service of the repository
 * @returns the prefix
 */
export function itemPrefix(group: CodeHostingGroup, forge: Forge | null): string {
  return group === "requests" && forge === "gitlab" ? "!" : "#";
}
