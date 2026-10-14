import type { ChatAgent } from "../stores/chats";

/** The characters of a session identifier that may reach the command line of a shell: a UUID has only these. */
const SESSION_ID = /^[A-Za-z0-9-]+$/;

/**
 * The address that opens a chat in the desktop application of its coding agent. Claude uses `claude://code/<id>`, and
 * Codex uses `codex://threads/<id>`.
 * @param agent - the coding agent of the chat
 * @param sessionId - the session identifier of the chat
 * @returns the address
 */
export function chatAppUrl(agent: ChatAgent, sessionId: string): string {
  const id = encodeURIComponent(sessionId);
  return agent === "codex" ? `codex://threads/${id}` : `claude://code/${id}`;
}

/**
 * The command that resumes a chat in a terminal: `claude --resume '<id>'`, or `codex resume '<id>'`.
 * @param agent - the coding agent of the chat
 * @param sessionId - the session identifier of the chat
 * @returns the command, or null when the identifier has a character that a shell could read as something else
 */
export function chatResumeCommand(agent: ChatAgent, sessionId: string): string | null {
  if (SESSION_ID.test(sessionId) === false) {
    return null;
  }
  return agent === "codex" ? `codex resume '${sessionId}'` : `claude --resume '${sessionId}'`;
}
