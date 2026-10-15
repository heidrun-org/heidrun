import ChildProcess from 'node:child_process';
import Fs from 'node:fs';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationProcess — runs one external process and retains its raw output
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Runs argument arrays without a shell, retries, model fallbacks or review calls. */
export class DocumentationProcess {
	/**
	 * Runs a writer or build process once and waits for its exit.
	 * @param command The executable to run.
	 * @param args Its arguments, without shell interpolation.
	 * @param repositoryPath The working checkout.
	 * @param logPath The stdout log; stderr is kept beside it with a .stderr suffix.
	 * @param input Optional writer prompt sent through standard input.
	 * @returns Resolves only when the process exits successfully.
	 */
	static async run(
		command: string,
		args: string[],
		repositoryPath: string,
		logPath: string,
		input?: string,
	): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			const childProcess = ChildProcess.spawn(command, args, {
				cwd: repositoryPath,
				stdio: ['pipe', 'pipe', 'pipe'],
				shell: false,
			});
			Fs.writeFileSync(logPath, '');
			Fs.writeFileSync(`${logPath}.stderr`, '');
			const interruptFn = (): void => { childProcess.kill('SIGINT'); };
			const terminateFn = (): void => { childProcess.kill('SIGTERM'); };
			process.once('SIGINT', interruptFn);
			process.once('SIGTERM', terminateFn);
			const heartbeat = setInterval(() => {
				process.stderr.write(`Still running ${command}; activity: ${logPath}\n`);
			}, 30_000);
			const cleanupFn = (): void => {
				clearInterval(heartbeat);
				process.removeListener('SIGINT', interruptFn);
				process.removeListener('SIGTERM', terminateFn);
			};
			childProcess.stdout.on('data', (data: Buffer) => { Fs.appendFileSync(logPath, data); });
			childProcess.stderr.on('data', (data: Buffer) => { Fs.appendFileSync(`${logPath}.stderr`, data); });
			let processError: Error | undefined;
			childProcess.on('error', (error) => {
				processError = error;
			});
			childProcess.stdin.on('error', (error) => {
				processError = error;
				childProcess.kill('SIGTERM');
			});
			childProcess.on('close', (code, signal) => {
				cleanupFn();
				if (processError !== undefined) {
					reject(processError);
				} else if (code === 0) {
					resolve();
				} else {
					reject(new Error(`${command} failed (${signal ?? code}); see ${logPath} and its .stderr file.`));
				}
			});
			childProcess.stdin.end(input ?? '');
		});
	}
}
