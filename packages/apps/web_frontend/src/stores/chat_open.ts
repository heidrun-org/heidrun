import { openUrl } from "@tauri-apps/plugin-opener";
import { chatAppUrl } from "../lib/chat_links";
import { launchAgent } from "./agents";
import type { Chat, ChatAgent } from "./chats";
import { state, toast } from "./session";

/**
 * Opens a chat in the desktop application of its coding agent, with the address of the application.
 * @param agent - the coding agent of the chat
 * @param chat - the chat to open
 */
export async function openChatInApp(agent: ChatAgent, chat: Chat) {
  try {
    await openUrl(chatAppUrl(agent, chat.id));
  } catch (reason) {
    toast(String(reason), "error");
  }
}

/**
 * Opens a chat in a new tab of the selected workspace: the coding agent starts there with its command to resume the chat.
 * @param agent - the coding agent of the chat
 * @param chat - the chat to open
 * @param folder - the folder whose chats the list shows, where the new tab starts
 */
export async function openChatInHeidrun(agent: ChatAgent, chat: Chat, folder: string | null) {
  if (state.selectedWorkspaceId === null) {
    return;
  }
  await launchAgent({
    workspaceId: state.selectedWorkspaceId,
    cwd: folder,
    tool: agent,
    agent: null,
    model: null,
    label: chat.title,
    prompt: "",
    resumeId: chat.id,
  });
}
