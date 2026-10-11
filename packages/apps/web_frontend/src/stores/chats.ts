import { computed, reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";

/** A coding agent that saves its conversations on this Mac. */
export type ChatAgent = "claude" | "codex";

/** The coding agents of the selector of the Chats sidebar section, in this order. */
export const CHAT_AGENTS: readonly ChatAgent[] = ["claude", "codex"];

/** One saved conversation between the developer and a coding agent. */
export interface Chat {
  /** The identifier that the coding agent gave to the conversation. */
  id: string;
  /** The title of the conversation, or its first message when the conversation has no title. */
  title: string;
  /** When the file of the conversation changed, in milliseconds since 1970. */
  updated_at: number;
}

/** What the Tauri command `chats_list` answers: the conversations of one folder, newest first, for each coding agent. */
type ChatsOfFolder = Record<ChatAgent, Chat[]>;

/**
 * The conversations of the folder of the selected workspace. `folder` is the folder whose conversations the lists hold.
 * `agent` is the coding agent that the developer chose in the selector.
 */
export const chats = reactive({
  folder: null as string | null,
  claude: [] as Chat[],
  codex: [] as Chat[],
  agent: "claude" as ChatAgent,
  /** True until the first answer for the folder arrives. */
  isLoading: false,
  /** The reason why the conversations could not be read, or null. */
  error: null as string | null,
});

/** The coding agents that have at least one conversation in the folder, in the order of the selector. */
export const availableChatAgents = computed(() => CHAT_AGENTS.filter((agent) => chats[agent].length > 0));

/** The coding agent that the list shows: the choice of the developer when it has conversations, else the first one that has. */
export const selectedChatAgent = computed<ChatAgent | null>(() => {
  if (availableChatAgents.value.includes(chats.agent)) {
    return chats.agent;
  }
  return availableChatAgents.value[0] ?? null;
});

/** The conversations that the list shows. */
export const shownChats = computed(() => (selectedChatAgent.value === null ? [] : chats[selectedChatAgent.value]));

/**
 * Reads the conversations of a folder again. A change of folder empties the lists first, so that the Chats sidebar section
 * never shows the conversations of another workspace. An answer for a folder that is no longer the current one is dropped.
 * @param folder - the folder of the selected workspace, or null when no workspace is selected
 */
export async function loadChats(folder: string | null): Promise<void> {
  if (chats.folder !== folder) {
    chats.folder = folder;
    chats.claude = [];
    chats.codex = [];
    chats.error = null;
  }
  if (folder === null) {
    chats.isLoading = false;
    return;
  }
  chats.isLoading = chats.claude.length === 0 && chats.codex.length === 0;
  try {
    const found = await invoke<ChatsOfFolder>("chats_list", { folder });
    if (chats.folder !== folder) {
      return;
    }
    chats.claude = found.claude;
    chats.codex = found.codex;
    chats.error = null;
  } catch (reason) {
    if (chats.folder === folder) {
      chats.error = String(reason instanceof Error ? reason.message : reason);
    }
  } finally {
    if (chats.folder === folder) {
      chats.isLoading = false;
    }
  }
}
