import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Fake Commands
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Creates a folder with fake `claude` and `codex` commands, and puts the folder at the start of the PATH.
 */
export class FakeCommands {
	/** The folder that holds the fake commands. */
	private _folder: string = '';

	/** The value of the PATH before the test. */
	private _originalPath: string = '';

	/**
	 * Creates the folder and puts it in the PATH.
	 * @param scriptByCommand The shell script of each fake command, by command name. A command without a script does
	 * not exist.
	 * @param isOnlyFolder When true, the PATH holds only the fake folder, so the real commands are not found.
	 * @returns Nothing.
	 */
	install(scriptByCommand: Record<string, string>, isOnlyFolder: boolean = false): void {
		this._folder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'raw_coding_agent_test_'));
		this._originalPath = process.env.PATH ?? '';
		for (const [command, script] of Object.entries(scriptByCommand)) {
			const commandPath = Path.join(this._folder, command);
			Fs.writeFileSync(commandPath, `#!/bin/sh\n${script}\n`);
			Fs.chmodSync(commandPath, 0o755);
		}
		process.env.PATH = isOnlyFolder === true ? this._folder : `${this._folder}${Path.delimiter}${this._originalPath}`;
	}

	/**
	 * Restores the PATH and removes the folder.
	 * @returns Nothing.
	 */
	uninstall(): void {
		process.env.PATH = this._originalPath;
		Fs.rmSync(this._folder, { recursive: true, force: true });
	}
}

/** The fake command script that prints its arguments, then its standard input. */
export const ECHO_SCRIPT = `printf 'arguments:%s\\n' "$*"\nprintf 'standard input:'\ncat`;
