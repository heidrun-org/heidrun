// The dynamic topics by the method "Language model". This file holds the parts that need no program of the computer: it
// writes the prompt, and it checks and reads the answer of the coding agent. The call itself, and the cache, are in the
// store `../stores/language_model_topics.ts`.
import type { Chat } from "../stores/chats";
import { MOST_TOPICS } from "./dynamic_topics";

/** The most chats that one call holds. A longer list is sent in several calls, one after the other. */
export const MOST_CHATS_PER_CALL = 20;

/** The most existing dynamic topics that a prompt holds, the most used first. */
const MOST_EXISTING_TOPICS = 100;

/** The most words in one dynamic topic. */
const MOST_TOPIC_WORDS = 2;

/**
 * The two parts of the dynamic topic source information of a chat that leave the computer for the method "Language
 * model". Nothing else of the chat is sent.
 */
export type LanguageModelChat = {
  /** The title of the chat. */
  title: string;
  /** The first messages that the developer typed, at most three, each one cut to 300 characters. */
  firstMessages: string[];
};

/**
 * What leaves the computer for one chat.
 * @param chat - the chat
 * @returns its title and its first messages
 */
export function languageModelChatOf(chat: Chat): LanguageModelChat {
  return { title: chat.title, firstMessages: chat.meta.first_messages };
}

/**
 * The dynamic topics that already exist, to give to the language model so that it reuses them.
 * @param entries - what the cache keeps for the chats, with the topics of each chat
 * @returns each topic once, the most used first, then in the alphabetical order, at most `MOST_EXISTING_TOPICS`
 */
export function existingTopicsOf(entries: Iterable<{ topics: string[] }>): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const topic of entry.topics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort(([leftTopic, leftCount], [rightTopic, rightCount]) => rightCount - leftCount || (leftTopic < rightTopic ? -1 : 1))
    .slice(0, MOST_EXISTING_TOPICS)
    .map(([topic]) => topic);
}

/**
 * The prompt that asks a coding agent for the dynamic topics of some chats. It holds the existing dynamic topics, and the
 * title and the first messages of each chat, and nothing else.
 * @param existingTopics - the dynamic topics that already exist
 * @param chats - the chats to ask about, in order: the first chat is the conversation 1
 * @returns the prompt
 */
export function languageModelPrompt(existingTopics: string[], chats: LanguageModelChat[]): string {
  const conversations = chats.map((chat, index) => ({ conversation: index + 1, ...chat }));
  return [
    "You find the topics of work conversations between a developer and a coding agent.",
    "",
    "For each conversation below, give one to three topics. A topic names one subject of the conversation, in one or two words, in lower case, in English, for example \"sidebar\" or \"cache\". Never write a sentence, a number, or a file name as a topic.",
    "",
    "Reuse an existing topic when it fits the subject, even when the words are different. Make a new topic only when no existing topic fits. This way, one subject always has one label.",
    "",
    `Answer with only a JSON array and no other text. The array has one item for each conversation, in this form: {"conversation": <number of the conversation>, "topics": ["<topic>", "<topic>"]}. Each conversation appears exactly once.`,
    "",
    `Existing topics: ${JSON.stringify(existingTopics)}`,
    `Conversations: ${JSON.stringify(conversations)}`,
  ].join("\n");
}

/** The words of a topic, in lower case, with one space between two words. */
function topicNameOf(value: string): string {
  return value.trim().toLowerCase().split(/\s+/).join(" ");
}

/**
 * Checks the answer of a coding agent, and reads it.
 * @param answer - the text that the coding agent printed
 * @param count - the number of chats that the prompt asked about
 * @returns the topics of each chat, in the order of the prompt, or null when the answer is wrong: not a JSON array, a
 * conversation that was not asked, a conversation twice, a conversation that is missing, a chat without topic or with
 * more than `MOST_TOPICS` topics, or a topic with more than two words
 */
export function parseLanguageModelAnswer(answer: string, count: number): string[][] | null {
  const start = answer.indexOf("[");
  const end = answer.lastIndexOf("]");
  if (start === -1 || end < start) {
    return null;
  }
  let items: unknown;
  try {
    items = JSON.parse(answer.slice(start, end + 1));
  } catch {
    return null;
  }
  if (Array.isArray(items) === false) {
    return null;
  }
  const topicsByConversation = new Map<number, string[]>();
  for (const item of items as unknown[]) {
    if (typeof item !== "object" || item === null) {
      return null;
    }
    const { conversation, topics } = item as Record<string, unknown>;
    if (
      typeof conversation !== "number" ||
      Number.isInteger(conversation) === false ||
      conversation < 1 ||
      conversation > count ||
      topicsByConversation.has(conversation) ||
      Array.isArray(topics) === false
    ) {
      return null;
    }
    const names: string[] = [];
    for (const topic of topics as unknown[]) {
      if (typeof topic !== "string") {
        return null;
      }
      const name = topicNameOf(topic);
      if (name === "" || name.split(" ").length > MOST_TOPIC_WORDS) {
        return null;
      }
      if (names.includes(name) === false) {
        names.push(name);
      }
    }
    if (names.length === 0 || names.length > MOST_TOPICS) {
      return null;
    }
    topicsByConversation.set(conversation, names);
  }
  if (topicsByConversation.size !== count) {
    return null;
  }
  return Array.from({ length: count }, (_, index) => topicsByConversation.get(index + 1) as string[]);
}
