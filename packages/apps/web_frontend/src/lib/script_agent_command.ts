import { findCodingAgent } from "./coding_agents";
import type { ScriptAgent } from "./project_config";

/** Puts `text` in single quotes, so that a shell reads it as one word, whatever it contains. */
export function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

/** Command line that starts the coding agent of a custom script of the kind Coding agent, with its prompt. */
export function scriptAgentCommand(agent: ScriptAgent): string {
  const definition = findCodingAgent(agent.name);
  if (definition === undefined) {
    throw new Error(`Unknown coding agent: ${agent.name}`);
  }
  const words = definition.buildWords(agent.model ?? "", agent.effort ?? "", shellQuote, shellQuote(agent.prompt.trim()));
  return words.join(" ");
}
