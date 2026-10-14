import type { RawCodingAgentName } from 'raw_coding_agent_cli';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationAgent — runs the coding agent for the update and for the judge
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Runs the coding agent with the package `raw_coding_agent_cli`. It is the only code that imports that package.
 */
export class DocumentationAgent {
	/**
	 * Runs a coding agent with the package `raw_coding_agent_cli` in the repository. The package is loaded only here.
	 * The type of this method is `RunDocumentationAgentFn`, so a test can give a fake coding agent in its place.
	 * @param prompt The prompt to send.
	 * @param agentName The name of the coding agent, `claude` or `codex`.
	 * @param repositoryPath The folder where the coding agent runs.
	 * @param onProgress Called with one line each time the coding agent does something, or undefined for none.
	 * @param isEditAllowed True when the coding agent may edit files.
	 * @param model The model of the coding agent, or undefined for the model of its own settings.
	 * @param effort The effort level of the coding agent, or undefined for the effort of its own settings.
	 * @returns The answer of the coding agent.
	 * @throws An error when the name is not the name of a known coding agent.
	 */
	static async run(
		prompt: string,
		agentName: string,
		repositoryPath: string,
		onProgress: ((message: string) => void) | undefined,
		isEditAllowed: boolean,
		model: string | undefined,
		effort: string | undefined,
	): Promise<string> {
		const { RawCodingAgent } = await import('raw_coding_agent_cli');
		const knownAgentName: RawCodingAgentName | undefined = RawCodingAgent.agentNames.find((name) => {
			return name === agentName;
		});
		if (knownAgentName === undefined) {
			throw new Error(`Unknown coding agent "${agentName}". Use ${RawCodingAgent.agentNames.join(' or ')}.`);
		}
		return RawCodingAgent.run({
			prompt,
			agentName: knownAgentName,
			workingDirectory: repositoryPath,
			isEditAllowed,
			onProgress,
			model,
			effort,
		});
	}
}
