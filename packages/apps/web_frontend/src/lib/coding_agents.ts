/** What the window Create a custom script needs to know to start one coding agent with a prompt. */
export type CodingAgentDefinition = {
  /** The identifier saved in the file `.heidrun/config.json`. */
  id: string;
  /** The name that the person reads. */
  label: string;
  /** The name of the Bootstrap Icons glyph, or of one of the icons of the application, shown before the label. */
  icon: string;
  /** The models that the window suggests. Empty when the coding agent has no option to choose the model. */
  models: string[];
  /** The efforts that the coding agent accepts, from the weakest to the strongest. Empty when it has no effort. */
  efforts: string[];
  /**
   * Builds the words of the command line before the prompt: the executable and its options.
   *
   * @param model - The model, or an empty string for the default model.
   * @param effort - The effort, or an empty string for the default effort.
   * @param quote - Puts a text in single quotes for the shell.
   * @param prompt - The prompt, already quoted for the shell.
   * @returns The words of the command line, the prompt included.
   */
  buildWords: (model: string, effort: string, quote: (text: string) => string, prompt: string) => string[];
};

/** The coding agents that a custom script can start. Each one lists its own models and efforts: they differ. */
export const CODING_AGENTS: CodingAgentDefinition[] = [
  {
    id: "claude",
    label: "Claude Code",
    icon: "claude",
    models: ["opus", "sonnet", "haiku"],
    efforts: ["low", "medium", "high", "xhigh", "max"],
    buildWords: (model, effort, quote, prompt) => {
      const words = ["claude"];
      if (model !== "") {
        words.push("--model", quote(model));
      }
      if (effort !== "") {
        words.push("--effort", quote(effort));
      }
      return [...words, prompt];
    },
  },
  {
    id: "codex",
    label: "Codex",
    icon: "openai",
    models: ["gpt-5", "gpt-5-codex"],
    efforts: ["minimal", "low", "medium", "high"],
    buildWords: (model, effort, quote, prompt) => {
      const words = ["codex"];
      if (model !== "") {
        words.push("-m", quote(model));
      }
      if (effort !== "") {
        words.push("-c", quote(`model_reasoning_effort="${effort}"`));
      }
      return [...words, prompt];
    },
  },
];

/** The identifiers of the coding agents, in the order of the list. */
export const CODING_AGENT_IDS = CODING_AGENTS.map((agent) => agent.id) as [string, ...string[]];

/** Finds the coding agent with the identifier `id`, or `undefined` when no coding agent has it. */
export function findCodingAgent(id: string): CodingAgentDefinition | undefined {
  return CODING_AGENTS.find((agent) => agent.id === id);
}
