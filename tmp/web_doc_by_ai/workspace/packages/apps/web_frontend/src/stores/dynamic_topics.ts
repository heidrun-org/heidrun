// The dynamic topics of the chats by the method "Keyword". The cache keeps, for each chat, the words of its dynamic topic
// source information with their weights, because reading the titles of the issues and of the pull requests on the forge is
// the expensive part. The topics themselves are ranked again each time, because the best words of a chat depend on the
// other chats that the list shows.
import { shallowReactive } from "vue";
import type { Forge } from "../lib/refs";
import {
  dynamicTopicReferences,
  dynamicTopicSourceInformation,
  dynamicTopicTerms,
  keywordTopics,
  type DynamicTopicDocument,
  type DynamicTopicReference,
  type DynamicTopicTerms,
} from "../lib/dynamic_topics";
import { loadChatReferenceDetails } from "./chat_references";
import type { Chat } from "./chats";

/** What the cache keeps for one chat. */
export type DynamicTopicEntry = {
  /** The date of the last message of the chat when the entry was made, in milliseconds since 1970. */
  lastAt: number;
  /** True when the entry holds the title of every issue and of every pull request that it should hold. */
  isComplete: boolean;
  /** The words of the dynamic topic source information of the chat, with their weights. */
  terms: DynamicTopicTerms;
};

/** Where the cache is saved: the `localStorage` of the web frontend. */
const KEY = "heidrun.dynamicTopicsCache";

/** The form of the saved cache. A cache of another version is dropped. */
const CACHE_VERSION = 1;

/** The most chats that the saved cache keeps. The chats with the oldest last message leave first. */
const MOST_ENTRIES = 200;

/** The most reads of the forge that run at the same time. */
const READS_AT_ONCE = 4;

/** True when a saved value has the form of an entry of the cache. */
function isEntry(value: unknown): value is DynamicTopicEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  const terms = entry.terms;
  return (
    typeof entry.lastAt === "number" &&
    typeof entry.isComplete === "boolean" &&
    typeof terms === "object" &&
    terms !== null &&
    Object.values(terms).every((weight) => typeof weight === "number")
  );
}

/** The entries that the last run saved, without the ones that are corrupted. */
function loadEntries(): Record<string, DynamicTopicEntry> {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (stored === null || stored.version !== CACHE_VERSION || typeof stored.keyword !== "object") {
      return {};
    }
    const entries: Record<string, DynamicTopicEntry> = {};
    for (const [id, entry] of Object.entries(stored.keyword ?? {})) {
      if (isEntry(entry)) {
        entries[id] = entry;
      }
    }
    return entries;
  } catch {
    return {};
  }
}

/** The cache of the method "Keyword", by identifier of chat. An entry is replaced as a whole, never changed. */
export const keywordEntries = shallowReactive<Record<string, DynamicTopicEntry>>(loadEntries());

/** Saves the cache. The chats with the oldest last message leave when the cache holds more than `MOST_ENTRIES` chats. */
function saveEntries(): void {
  const ids = Object.keys(keywordEntries);
  if (ids.length > MOST_ENTRIES) {
    ids.sort((left, right) => keywordEntries[right].lastAt - keywordEntries[left].lastAt);
    for (const id of ids.slice(MOST_ENTRIES)) {
      delete keywordEntries[id];
    }
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: CACHE_VERSION, keyword: keywordEntries }));
  } catch {
    /* the cache is a convenience */
  }
}

/** The titles that the forge gave in this run, by folder, kind, and number. A failed read leaves no trace, so a later run retries it. */
const referenceTitles = new Map<string, string>();

/** The chats that already tried to read their titles in this run, so a forge that fails is not asked every 10 seconds. */
const attempts = new Set<string>();

/** The key of an issue or of a pull request in `referenceTitles`. */
function titleKey(folder: string, reference: DynamicTopicReference): string {
  return `${folder}|${reference.kind}|${reference.number}`;
}

/** The date of the last message of a chat, or the date of its file when the scan found no date. */
export function lastMessageAt(chat: Chat): number {
  return chat.meta.last_at ?? chat.updated_at;
}

/** Runs `work` for each item, with at most `limit` runs at the same time. */
async function runLimited<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * The entry of a chat, with the titles that this run already knows.
 * @param chat - the chat
 * @param root - the root of the repository, or null when it is not known
 * @param folder - the folder of the workspace, where the titles were read, or null when it is not known
 * @returns the entry, complete when every title is known
 */
function entryOf(chat: Chat, root: string | null, folder: string | null): DynamicTopicEntry {
  const references = dynamicTopicReferences(chat.meta);
  const titles: string[] = [];
  for (const reference of references) {
    const title = folder === null ? undefined : referenceTitles.get(titleKey(folder, reference));
    if (title !== undefined) {
      titles.push(title);
    }
  }
  return {
    lastAt: lastMessageAt(chat),
    isComplete: titles.length === references.length,
    terms: dynamicTopicTerms(dynamicTopicSourceInformation(chat, root, titles)),
  };
}

/** Where a chat is: the folder of the workspace, the root of its repository, and the forge of its repository. */
export type DynamicTopicContext = {
  /** The folder of the selected workspace, or null when it is not known. */
  folder: string | null;
  /** The root of the repository that holds the folder, or null when it is not known. */
  root: string | null;
  /** The forge of the repository, or null when it is not known or the repository has no remote. */
  forge: Forge | null;
};

/**
 * Makes the cache hold a fresh entry for each chat. A chat whose last message did not change keeps its entry, so nothing
 * is read again. A new or changed chat gets its entry at once from the title, the first messages, and the folders of the
 * files. Then the titles of its issues and of its pull requests are read on the forge, and the entry is made again with
 * them. A chat tries to read its titles once in each run.
 * @param chatList - the chats that the list shows
 * @param context - the folder, the root, and the forge of the selected workspace
 */
export async function prepareKeywordTopics(chatList: Chat[], context: DynamicTopicContext): Promise<void> {
  const toRead: Chat[] = [];
  let isChanged = false;
  for (const chat of chatList) {
    const entry = keywordEntries[chat.id];
    if (entry === undefined || entry.lastAt !== lastMessageAt(chat)) {
      keywordEntries[chat.id] = entryOf(chat, context.root, context.folder);
      isChanged = true;
    }
    const attemptKey = `${chat.id}|${lastMessageAt(chat)}`;
    if (keywordEntries[chat.id].isComplete === false && context.forge !== null && attempts.has(attemptKey) === false) {
      attempts.add(attemptKey);
      toRead.push(chat);
    }
  }
  if (isChanged) {
    saveEntries();
  }
  const { folder, forge } = context;
  if (toRead.length === 0 || folder === null || forge === null) {
    return;
  }
  const unread = new Map<string, DynamicTopicReference>();
  for (const chat of toRead) {
    for (const reference of dynamicTopicReferences(chat.meta)) {
      const key = titleKey(folder, reference);
      if (referenceTitles.has(key) === false) {
        unread.set(key, reference);
      }
    }
  }
  await runLimited([...unread], READS_AT_ONCE, async ([key, reference]) => {
    const details = await loadChatReferenceDetails(folder, forge, { ...reference, url: null });
    if (details !== null) {
      referenceTitles.set(key, details.title);
    }
  });
  for (const chat of toRead) {
    if (keywordEntries[chat.id]?.lastAt === lastMessageAt(chat)) {
      keywordEntries[chat.id] = entryOf(chat, context.root, folder);
    }
  }
  saveEntries();
}

/**
 * The dynamic topics of the chats that the list shows, by the method "Keyword". It reads the cache, so a component that
 * calls it in a computed value shows the new topics when the cache changes.
 * @param chatList - the chats that the list shows
 * @returns for each identifier of a chat that has an entry, its topics
 */
export function keywordTopicsOf(chatList: Chat[]): Map<string, string[]> {
  const documents: DynamicTopicDocument[] = [];
  for (const chat of chatList) {
    const entry = keywordEntries[chat.id];
    if (entry !== undefined) {
      documents.push({ id: chat.id, terms: entry.terms });
    }
  }
  return keywordTopics(documents);
}
