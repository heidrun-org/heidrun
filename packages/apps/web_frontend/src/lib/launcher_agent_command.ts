import { findCodingAgent } from "./coding_agents";
import type { LauncherAgent } from "./project_config";

/** Puts `text` in single quotes, so that a shell reads it as one word, whatever it contains. */
export function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

/** Command line that starts the coding agent of a custom launcher of the kind Coding agent, with its prompt. */
export function launcherAgentCommand(agent: LauncherAgent): string {
  const definition = findCodingAgent(agent.name);
  if (definition === undefined) {
    throw new Error(`Unknown coding agent: ${agent.name}`);
  }
  const words = definition.buildArguments(agent.model ?? "", agent.effort ?? "", shellQuote, shellQuote(agent.prompt.trim()));
  return [definition.executable, ...words].join(" ");
}
