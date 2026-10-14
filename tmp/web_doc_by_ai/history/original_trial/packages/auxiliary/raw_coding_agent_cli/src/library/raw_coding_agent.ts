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
	/** The folder where the coding agent runs. When undefined, the folder of the current process. */
	workingDirectory?: string;
	/**
	 * When true, the coding agent may edit the files of the working directory, and `claude` may also run read-only
	 * `git` commands and `gh issue view`. When false or undefined, the coding agent only answers.
	 */
	isEditAllowed?: boolean;
	/**
	 * Called with one short line each time the coding agent does something, so the caller can show the progress.
	 * `claude` then runs with `--output-format stream-json --verbose`, and the line says which tool it uses or what it
	 * writes. `codex` sends the lines of its standard error output. The returned answer does not change.
	 */
	onProgress?: (message: string) => void;
	/**
	 * The model of the coding agent, for example `opus` for `claude` or `gpt-5-codex` for `codex`. When undefined, the
	 * coding agent uses the model of its own settings. Both commands get `--model`.
	 */
	model?: string;
	/**
	 * The effort level of the coding agent, for example `low`, `medium`, or `high`. When undefined, the coding agent
	 * uses the effort of its own settings. `claude` gets `--effort`, and `codex` gets
	 * `-c model_reasoning_effort="<effort>"`.
	 */
	effort?: string;
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
	/** The names of all the coding agents that the class can run. */
	static readonly agentNames: RawCodingAgentName[] = ['codex', 'claude'];

	/**
	 * Runs the coding agent, sends the prompt through the standard input, and waits for the coding agent to exit.
	 * @param options The prompt and the name of the coding agent.
	 * @returns The text that the coding agent prints on the standard output, without the spaces and the line
	 * breaks at the start and at the end.
	 * @throws An error when the command is not installed, or when the command exits with an error code. The
	 * message of the error contains the standard error output of the command.
	 */
	static async run(options: RawCodingAgentRunOptions): Promise<string> {
		const isStreaming = options.onProgress !== undefined;
		const commandLine = RawCodingAgent._getCommandLine(options, isStreaming);
		const answer = await RawCodingAgent._spawnAndCollect(
			commandLine,
			options.prompt,
			options.workingDirectory,
			options.onProgress,
			isStreaming === true && options.agentName === 'claude',
		);
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
	 * When `isEditAllowed` is true, `claude` gets `--permission-mode acceptEdits` and the read-only commands `git log`,
	 * `git diff`, `git show`, and `gh issue view`, and `codex` gets `--sandbox workspace-write`.
	 * @param options The options of the method `run`: the coding agent, the permission to edit, the model, and the
	 * effort.
	 * @param isStreaming True when the caller wants progress lines: `claude` then prints one JSON line for each event.
	 * @returns The command and the arguments.
	 */
	private static _getCommandLine(options: RawCodingAgentRunOptions, isStreaming: boolean): RawCodingAgentCommandLine {
		if (options.agentName === 'claude') {
			const args = ['-p'];
			if (isStreaming === true) {
				args.push('--output-format', 'stream-json', '--verbose');
			}
			if (options.isEditAllowed === true) {
				args.push(
					'--permission-mode',
					'acceptEdits',
					'--allowedTools',
					'Bash(git log:*),Bash(git diff:*),Bash(git show:*),Bash(gh issue view:*)',
				);
			}
			if (options.model !== undefined) {
				args.push('--model', options.model);
			}
			if (options.effort !== undefined) {
				args.push('--effort', options.effort);
			}
			return {
				command: 'claude',
				args,
			};
		}
		const args = ['exec', '--skip-git-repo-check'];
		if (options.isEditAllowed === true) {
			args.push('--sandbox', 'workspace-write');
		}
		if (options.model !== undefined) {
			args.push('--model', options.model);
		}
		if (options.effort !== undefined) {
			args.push('-c', `model_reasoning_effort="${options.effort}"`);
		}
		args.push('-');
		return {
			command: 'codex',
			args,
		};
	}

	/**
	 * Starts the command, writes the prompt on its standard input, and collects its standard output and its
	 * standard error output until the command exits.
	 * @param commandLine The command and the arguments to run.
	 * @param prompt The text to write on the standard input of the command.
	 * @param workingDirectory The folder to run the command in, or undefined for the folder of the current process.
	 * @param onProgress Called with each progress line, or undefined for none.
	 * @param isStreamJson True when the standard output holds one JSON event for each line, as `claude` prints with
	 * `--output-format stream-json`. The answer is then the field `result` of the last event.
	 * @returns The standard output of the command, without the spaces and the line breaks at the start and at the
	 * end.
	 */
	private static _spawnAndCollect(
		commandLine: RawCodingAgentCommandLine,
		prompt: string,
		workingDirectory: string | undefined,
		onProgress: ((message: string) => void) | undefined,
		isStreamJson: boolean,
	): Promise<string> {
		return new Promise((resolve, reject) => {
			const childProcess = ChildProcess.spawn(commandLine.command, commandLine.args, {
				cwd: workingDirectory,
				stdio: ['pipe', 'pipe', 'pipe'],
			});
			let stdoutStr = '';
			let stderrStr = '';
			let pendingLineStr = '';
			let resultStr: string | null = null;
			childProcess.stdout.setEncoding('utf8');
			childProcess.stderr.setEncoding('utf8');
			childProcess.stdout.on('data', (chunk: string) => {
				stdoutStr += chunk;
				if (isStreamJson === false) {
					return;
				}
				pendingLineStr += chunk;
				const lines = pendingLineStr.split('\n');
				pendingLineStr = lines.pop() ?? '';
				for (const line of lines) {
					const event = RawCodingAgent._readStreamJsonLine(line);
					resultStr = event.result ?? resultStr;
					for (const message of event.progress) {
						onProgress?.(message);
					}
				}
			});
			childProcess.stderr.on('data', (chunk: string) => {
				stderrStr += chunk;
				if (onProgress === undefined || isStreamJson === true) {
					return;
				}
				for (const line of chunk.split('\n')) {
					if (line.trim() !== '') {
						onProgress(line.trim());
					}
				}
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
					resolve(isStreamJson === true ? (resultStr ?? '').trim() : stdoutStr.trim());
					return;
				}
				const reasonStr = signal === null ? `exit code ${exitCode}` : `signal ${signal}`;
				reject(new Error(`The command "${commandLine.command}" failed with ${reasonStr}.\n${stderrStr.trim()}`));
			});
			childProcess.stdin.end(prompt);
		});
	}

	/**
	 * Reads one line of the output `stream-json` of `claude`.
	 * @param line One line of the standard output. A line that is not a JSON object is ignored.
	 * @returns The progress lines of the event: the first line of each text, and the name of each tool with its main
	 * argument. Also the final answer when the event is the last one, or null.
	 */
	private static _readStreamJsonLine(line: string): { progress: string[]; result: string | null } {
		const nothing = {
			progress: [],
			result: null,
		};
		let event: {
			type?: string;
			result?: string;
			message?: { content?: { type?: string; text?: string; name?: string; input?: Record<string, unknown> }[] };
		};
		try {
			event = JSON.parse(line);
		} catch {
			return nothing;
		}
		if (event.type === 'result') {
			return {
				progress: [],
				result: typeof event.result === 'string' ? event.result : null,
			};
		}
		if (event.type !== 'assistant') {
			return nothing;
		}
		const progress: string[] = [];
		for (const block of event.message?.content ?? []) {
			if (block.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '') {
				progress.push(block.text.trim().split('\n')[0]);
			}
			if (block.type === 'tool_use') {
				const input = block.input ?? {};
				const mainArgument = [input.file_path, input.path, input.command, input.pattern].find((value) => {
					return typeof value === 'string';
				});
				progress.push(`${block.name} ${mainArgument ?? ''}`.trim());
			}
		}
		return {
			progress,
			result: null,
		};
	}
}
