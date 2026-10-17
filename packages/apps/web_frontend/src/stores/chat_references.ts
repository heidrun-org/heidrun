// What the code hosting service says about the issues and the pull requests that a chat mentions: the title, the state, the
// description, the labels, the person who opened it, the date, and the branches.
//
// On GitHub the details come from the SQLite file of the data layer. The Tauri command `chat_references_synchronize` copies
// the issues and the pull requests of the repository into the file, and the Tauri command `chat_references_find` reads the
// stored rows. A synchronization is kept for ten minutes. On GitLab the details are still read live by
// `forge_reference_details.ts`, because the package `data_layer_code_hosting` reads GitHub only (issue 455); this is the only
// exception that docs/agents_rules/data_layer_access.md allows for the Past chats sidebar section.
import { invoke } from "@tauri-apps/api/core";
import { chatReferenceTimeOf, githubAvatarUrl, type ChatReference } from "../lib/chat_references";
import type { Forge } from "../lib/refs";
import { loadForgeReferenceDetails } from "./forge_reference_details";

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

/** What the Tauri command `chat_references_synchronize` answers. */
type ChatReferencesSynchronization = {
  /** The repository, in the format `owner/name`. */
  repository: string;
  /** The reason why GitHub could not be read, or null. The stored rows are then the ones that an earlier read wrote. */
  codeHostingError: string | null;
};

/** An issue as the SQLite file stores it. */
type StoredIssue = {
  title: string;
  body: string;
  state: string;
  author: string | null;
  labels: string[];
  labelColors: Record<string, string>;
  createdAt: string;
};

/** An issue or a pull request as the SQLite file stores it. Only a pull request has the two branches. */
type StoredReference = StoredIssue & {
  number: number;
  headRefName?: string;
  baseRefName?: string;
};

/** What the Tauri command `chat_references_find` answers. */
type StoredReferences = {
  issues: StoredReference[];
  pullRequests: StoredReference[];
};

/** How long a synchronization of a folder is kept, in milliseconds. */
const SYNCHRONIZATION_LIFETIME = 10 * 60 * 1000;

/** How old a synchronization must be before a missing issue or pull request makes a new one, in milliseconds. */
const MISSING_ROW_RETRY_AGE = 60 * 1000;

/** The synchronizations that run or ran, by folder. A failed synchronization is forgotten, so the next call tries again. */
const synchronizations = new Map<
  string,
  { startedAt: number; promise: Promise<ChatReferencesSynchronization | null> }
>();

/**
 * Copies the issues and the pull requests of the GitHub repository of a folder into the SQLite file, once for ten minutes.
 * @param folder - the folder of the workspace
 * @param isForced - true to synchronize again even when a synchronization is kept
 * @returns the repository, or null when the synchronization failed (for example, the folder has no remote)
 */
function synchronizeChatReferences(
  folder: string,
  isForced: boolean,
): { startedAt: number; promise: Promise<ChatReferencesSynchronization | null> } {
  const known = synchronizations.get(folder);
  if (known !== undefined && isForced === false && Date.now() - known.startedAt < SYNCHRONIZATION_LIFETIME) {
    return known;
  }
  const startedAt = Date.now();
  const entry = {
    startedAt,
    promise: invoke<ChatReferencesSynchronization>("chat_references_synchronize", { folder })
      .catch(() => null)
      .then((result) => {
        const synchronization = typeof result?.repository === "string" ? result : null;
        if (synchronization === null && synchronizations.get(folder)?.startedAt === startedAt) {
          synchronizations.delete(folder);
        }
        return synchronization;
      }),
  };
  synchronizations.set(folder, entry);
  return entry;
}

/**
 * Starts the synchronization of the GitHub repository of a folder in the background, so the first card of an issue or of a
 * pull request opens without waiting for it.
 * @param folder - the folder of the workspace
 */
export function prepareChatReferences(folder: string): void {
  void synchronizeChatReferences(folder, false).promise;
}

/**
 * The details of an issue or of a pull request.
 * @param folder - the folder of the workspace, where the repository is
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
    return forge === "github" ? await readGithub(folder, reference) : await loadForgeReferenceDetails(folder, forge, reference);
  } catch {
    return null;
  }
}

/** The details of an issue or of a pull request of GitHub, read from the SQLite file. */
async function readGithub(folder: string, reference: ChatReference): Promise<ChatReferenceDetails | null> {
  let synchronization = synchronizeChatReferences(folder, false);
  let repository = (await synchronization.promise)?.repository;
  if (repository === undefined) {
    return null;
  }
  let details = await findGithubDetails(repository, reference);
  if (details === null && Date.now() - synchronization.startedAt > MISSING_ROW_RETRY_AGE) {
    synchronization = synchronizeChatReferences(folder, true);
    repository = (await synchronization.promise)?.repository;
    details = repository === undefined ? null : await findGithubDetails(repository, reference);
  }
  return details;
}

/** The stored row of an issue or of a pull request of GitHub, as details, or null when the SQLite file has no such row. */
async function findGithubDetails(repository: string, reference: ChatReference): Promise<ChatReferenceDetails | null> {
  const isIssue = reference.kind === "issue";
  const rows = await invoke<StoredReferences>("chat_references_find", {
    repository,
    issues: isIssue ? [reference.number] : [],
    pullRequests: isIssue ? [] : [reference.number],
  });
  const row = isIssue ? rows.issues[0] : rows.pullRequests[0];
  if (row === undefined) {
    return null;
  }
  return {
    title: row.title,
    rawState: row.state.toLowerCase(),
    body: row.body,
    labels: row.labels.map((name) => ({ name, color: row.labelColors[name] ?? null })),
    author: row.author,
    authorAvatarUrl: githubAvatarUrl(row.author ?? undefined),
    createdAt: chatReferenceTimeOf(row.createdAt),
    headBranch: row.headRefName ?? null,
    baseBranch: row.baseRefName ?? null,
  };
}
