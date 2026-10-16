import ChildProcess from 'node:child_process';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ProgramRunner — runs a program of the computer and waits for its end
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * What a program wrote.
 */
export type ProgramOutput = {
	/** The text that the program wrote on its standard output. */
	standardOutput: string;
	/** The text that the program wrote on its standard error. The program `ffmpeg` writes its report here. */
	standardError: string;
};

/**
 * Runs the programs `ffmpeg` and `ffprobe`, and gives back what they wrote.
 */
export class ProgramRunner {
	/**
	 * Runs a program and waits for its end.
	 * @param program The name of the program.
	 * @param programArguments The arguments.
	 * @returns What the program wrote.
	 * @throws An error with the text of the program, when the program stops with a code that is not zero.
	 */
	static async run(program: string, programArguments: string[]): Promise<ProgramOutput> {
		return new Promise<ProgramOutput>((resolve, reject) => {
			const childProcess = ChildProcess.spawn(program, programArguments);
			let standardOutput = '';
			let standardError = '';
			childProcess.stdout.on('data', (chunk: Buffer) => {
				standardOutput += chunk.toString();
			});
			childProcess.stderr.on('data', (chunk: Buffer) => {
				standardError += chunk.toString();
			});
			childProcess.on('error', reject);
			childProcess.on('close', (code) => {
				if (code === 0) {
					resolve({
						standardOutput,
						standardError,
					});
					return;
				}
				reject(new Error(`The program ${program} stopped with the code ${code}:\n${standardError}`));
			});
		});
	}
}
