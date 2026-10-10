import ChildProcess from 'node:child_process';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	RawCodingAgent — sends one prompt to a coding agent command line tool and returns the answer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The name of a coding agent that the package can run. The name is also the name of the command.
 */
export type RawCodingAgentName = 'claude' | 'codex';

/**
 * The options of the method `RawCodingAgent.run`.
 */
export type RawCodingAgentRunOptions = {
	/** The prompt to send to the coding agent. The package sends it through the standard input. */
	prompt: string;
	/** The coding agent to run: `claude` runs `claude -p`, and `codex` runs `codex exec`. */
	agentName: RawCodingAgentName;
};

/**
 * The command and the arguments that run one coding agent.
 */
type RawCodingAgentCommandLine = {
	/** The name of the command to run. */
	command: string;
	/** The arguments of the command. */
	args: string[];
};

/**
 * Sends one prompt to a coding agent command line tool, waits for the answer, and returns the answer as text.
 * The class keeps no conversation: each call is one prompt and one answer.
 */
export class RawCodingAgent {
	/**
	 * Runs the coding agent, sends the prompt through the standard input, and waits for the coding agent to exit.
	 * @param options The prompt and the name of the coding agent.
	 * @returns The text that the coding agent prints on the standard output, without the spaces and the line
	 * breaks at the start and at the end.
	 * @throws An error when the command is not installed, or when the command exits with an error code. The
	 * message of the error contains the standard error output of the command.
	 */
	static async run(options: RawCodingAgentRunOptions): Promise<string> {
		const commandLine = RawCodingAgent._getCommandLine(options.agentName);
		const answer = await RawCodingAgent._spawnAndCollect(commandLine, options.prompt);
		return answer;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Gives the command and the arguments that run one coding agent with a prompt on the standard input.
	 * The flag `--skip-git-repo-check` lets `codex exec` run outside of a trusted Git repository.
	 * @param agentName The coding agent to run.
	 * @returns The command and the arguments.
	 */
	private static _getCommandLine(agentName: RawCodingAgentName): RawCodingAgentCommandLine {
		if (agentName === 'claude') {
			return {
				command: 'claude',
				args: ['-p'],
			};
		}
		return {
			command: 'codex',
			args: ['exec', '--skip-git-repo-check', '-'],
		};
	}

	/**
	 * Starts the command, writes the prompt on its standard input, and collects its standard output and its
	 * standard error output until the command exits.
	 * @param commandLine The command and the arguments to run.
	 * @param prompt The text to write on the standard input of the command.
	 * @returns The standard output of the command, without the spaces and the line breaks at the start and at the
	 * end.
	 */
	private static _spawnAndCollect(commandLine: RawCodingAgentCommandLine, prompt: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const childProcess = ChildProcess.spawn(commandLine.command, commandLine.args, {
				stdio: ['pipe', 'pipe', 'pipe'],
			});
			let stdoutStr = '';
			let stderrStr = '';
			childProcess.stdout.setEncoding('utf8');
			childProcess.stderr.setEncoding('utf8');
			childProcess.stdout.on('data', (chunk: string) => {
				stdoutStr += chunk;
			});
			childProcess.stderr.on('data', (chunk: string) => {
				stderrStr += chunk;
			});
			childProcess.stdin.on('error', () => {
				// The command can exit before it reads the whole prompt. The event 'close' reports the exit code.
			});
			childProcess.on('error', (error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') {
					reject(new Error(`The command "${commandLine.command}" is not installed or is not in the PATH.`));
					return;
				}
				reject(error);
			});
			childProcess.on('close', (exitCode, signal) => {
				if (exitCode === 0) {
					resolve(stdoutStr.trim());
					return;
				}
				const reasonStr = signal === null ? `exit code ${exitCode}` : `signal ${signal}`;
				reject(new Error(`The command "${commandLine.command}" failed with ${reasonStr}.\n${stderrStr.trim()}`));
			});
			childProcess.stdin.end(prompt);
		});
	}
}
