/** A coding agent that Heidrun knows. */
export interface AgentDefinition {
  /** The identifier saved in the settings. */
  id: "claude" | "codex";
  /** The name of the product, shown as it is in every language. */
  name: string;
}

/** The coding agents that Heidrun knows. To add an agent, add one line here. */
export const AGENTS: AgentDefinition[] = [
  { id: "claude", name: "Claude Code" },
  { id: "codex", name: "Codex" },
];
