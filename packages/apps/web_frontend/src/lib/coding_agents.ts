/** What the window Create a custom script needs to know to start one coding agent with a prompt. */
export type CodingAgentDefinition = {
  /** The identifier saved in the file `.heidrun/config.json`. */
  id: string;
  /** The name that the person reads. */
  label: string;
  /** The name of the Bootstrap Icons glyph, or of one of the icons of the application, shown before the label. */
  icon: string;
  /** The name of the program that the shell runs, the first word of the command line. */
  executable: string;
  /**
   * True when the coding agent can start with a prompt and stay interactive, so that the developer can answer in the
   * pane. The window Create a custom script offers only the coding agents for which this is true.
   */
  canStartInteractiveWithPrompt: boolean;
  /** The models that the window suggests. Empty when the coding agent has no option to choose the model. */
  models: string[];
  /** The efforts that the coding agent accepts, from the weakest to the strongest. Empty when it has no effort. */
  efforts: string[];
  /**
   * Builds the words of the command line after the executable: the options, and the prompt where the coding agent
   * wants it.
   *
   * @param model - The model, or an empty string for the default model.
   * @param effort - The effort, or an empty string for the default effort.
   * @param quote - Puts a text in single quotes for the shell.
   * @param prompt - The prompt, already quoted for the shell.
   * @returns The words after the executable, the prompt included.
   */
  buildArguments: (model: string, effort: string, quote: (text: string) => string, prompt: string) => string[];
};

/** The coding agents that Heidrun supports. Each one lists its own models and efforts: they differ. */
export const CODING_AGENTS: CodingAgentDefinition[] = [
  {
    id: "claude",
    label: "Claude Code",
    icon: "claude",
    executable: "claude",
    canStartInteractiveWithPrompt: true,
    models: ["opus", "sonnet", "haiku"],
    efforts: ["low", "medium", "high", "xhigh", "max"],
    buildArguments: (model, effort, quote, prompt) => {
      const words: string[] = [];
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
    executable: "codex",
    canStartInteractiveWithPrompt: true,
    models: ["gpt-5", "gpt-5-codex"],
    efforts: ["minimal", "low", "medium", "high"],
    buildArguments: (model, effort, quote, prompt) => {
      const words: string[] = [];
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

/** The coding agents that the window Create a custom script offers: the ones that start interactive with a prompt. */
export const CUSTOM_SCRIPT_CODING_AGENTS = CODING_AGENTS.filter((agent) => agent.canStartInteractiveWithPrompt);

/** The identifiers of the coding agents that the window Create a custom script offers, in the order of the list. */
export const CUSTOM_SCRIPT_CODING_AGENT_IDS = CUSTOM_SCRIPT_CODING_AGENTS.map((agent) => agent.id) as [string, ...string[]];

/** Finds the coding agent with the identifier `id`, or `undefined` when no coding agent has it. */
export function findCodingAgent(id: string): CodingAgentDefinition | undefined {
  return CODING_AGENTS.find((agent) => agent.id === id);
}
