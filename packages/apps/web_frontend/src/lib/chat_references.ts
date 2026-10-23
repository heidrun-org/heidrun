import { t } from "../i18n/index";
import { dayText } from "./chat_summary";
import { issueUrl, mrUrl, type Forge } from "./refs";

/** The kind of a reference: an issue, or a pull request (a merge request on GitLab). */
export type ChatReferenceKind = "issue" | "pull_request";

/** An issue or a pull request that a chat mentions, ready for the line of the summary and for its information card. */
export type ChatReference = {
  /** An issue, or a pull request. */
  kind: ChatReferenceKind;
  /** The number of the issue or of the pull request. */
  number: number;
  /** The web page of the issue or of the pull request, or null when the repository has no remote. */
  url: string | null;
};

/**
 * The issues, then the pull requests, that a chat mentions.
 * @param issues - the numbers of the issues
 * @param pullRequests - the numbers of the pull requests
 * @param webBase - the address of the repository on its forge, or null when the repository has no remote
 * @param forge - the forge of the repository, or null when the repository has no remote
 * @returns one entry for each number, the issues first
 */
export function chatReferences(
  issues: number[],
  pullRequests: number[],
  webBase: string | null,
  forge: Forge | null,
): ChatReference[] {
  return [
    ...issues.map((number) => ({ kind: "issue" as const, number, url: issueUrl(webBase, forge, String(number)) })),
    ...pullRequests.map((number) => ({
      kind: "pull_request" as const,
      number,
      url: mrUrl(webBase, forge, String(number)),
    })),
  ];
}

/**
 * The text that names a reference: "Issue #250" or "Pull request #249". It uses the same texts as the line of the summary.
 * @param reference - the issue or the pull request
 * @returns the text
 */
export function chatReferenceName(reference: ChatReference): string {
  const key = reference.kind === "issue" ? "chatsPanel.issues" : "chatsPanel.pullRequests";
  return t(key, { count: 1, numbers: `#${reference.number}` });
}

/** How the state of an issue or of a pull request looks. */
export type ChatReferenceState = {
  /** The text of the state, for example "Closed". */
  text: string;
  /** The icon of the state. */
  icon: string;
  /** The class of the color of the pill: "state-open", "state-closed", "state-done", or "state-other". */
  look: string;
};

/**
 * How the state of an issue or of a pull request looks, as on GitHub: green for open, purple for merged or for a closed
 * issue, red for a closed pull request.
 * @param kind - an issue, or a pull request
 * @param rawState - the state in lower case, as the forge says it
 * @returns the text, the icon, and the class of the color
 */
export function chatReferenceState(kind: ChatReferenceKind, rawState: string): ChatReferenceState {
  if (rawState === "open") {
    return { text: t("chatsPanel.stateOpen"), icon: kind === "issue" ? "record-circle" : "git", look: "state-open" };
  }
  if (rawState === "merged") {
    return { text: t("chatsPanel.stateMerged"), icon: "sign-merge-right", look: "state-done" };
  }
  if (rawState === "closed") {
    const isIssue = kind === "issue";
    return {
      text: t("chatsPanel.stateClosed"),
      icon: isIssue ? "check-circle" : "x-circle",
      look: isIssue ? "state-done" : "state-closed",
    };
  }
  return { text: rawState, icon: "circle-half", look: "state-other" };
}

/**
 * The name of a repository for the card: the path of its address, for example "heidrun-org/heidrun".
 * @param webBase - the address of the repository on its forge, or null
 * @returns the name, or null when the address is not known or is not valid
 */
export function repositoryName(webBase: string | null): string | null {
  if (webBase === null) {
    return null;
  }
  try {
    return new URL(webBase).pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    return null;
  }
}

/**
 * The beginning of the description of an issue or of a pull request, as plain text: the marks of Markdown for a heading,
 * a link, an image, a code span, and a bold word are removed, and the empty lines are removed.
 * @param body - the description in Markdown
 * @returns the plain text, never longer than 400 characters
 */
export function referenceExcerpt(body: string): string {
  const plain = body
    .replace(/\r/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*```.*$/gm, "")
    .replace(/(\*\*|__|`)/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return plain.length > 400 ? `${plain.slice(0, 400)}…` : plain;
}

/**
 * The style of a label: its color for the text, a tint of it for the background and the border, as GitHub draws it.
 * @param color - the color of the label as six hexadecimal digits without `#`, or null when the forge gives no color
 * @returns the CSS properties, or an empty object when the color is null
 */
export function referenceLabelStyle(color: string | null): Record<string, string> {
  if (color === null) {
    return {};
  }
  return {
    color: `color-mix(in srgb, #${color} 70%, var(--fg-body))`,
    backgroundColor: `color-mix(in srgb, #${color} 15%, transparent)`,
    borderColor: `color-mix(in srgb, #${color} 50%, transparent)`,
  };
}

/**
 * The date of the card: "Oct 11", with the year when it is not the current year.
 * @param createdAt - the date of the creation in milliseconds since 1970, or null
 * @returns the text, or an empty text when the date is not known
 */
export function referenceDay(createdAt: number | null): string {
  return createdAt === null ? "" : dayText(new Date(createdAt), new Date());
}

/**
 * The time of a date in the text that a forge gives.
 * @param text - the date, an ISO 8601 text, or nothing
 * @returns the time in milliseconds since 1970, or null when there is no valid date
 */
export function chatReferenceTimeOf(text: string | undefined | null): number | null {
  return text === undefined || text === null ? null : Date.parse(text) || null;
}

/**
 * The address of the picture of a person on GitHub. GitHub gives the picture of a person at `https://github.com/<login>.png`.
 * @param login - the login of the person, or nothing
 * @returns the address, or null when there is no login or the login is not a login of a person (for example "app/name")
 */
export function githubAvatarUrl(login: string | undefined): string | null {
  if (login === undefined || /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(login) === false) {
    return null;
  }
  return `https://github.com/${login}.png?size=48`;
}
