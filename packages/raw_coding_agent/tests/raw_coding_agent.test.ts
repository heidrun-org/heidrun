import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RawCodingAgent } from '../src/index.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Fake Commands
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Creates a folder with fake `claude` and `codex` commands, and puts the folder at the start of the PATH.
 */
class FakeCommands {
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

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const ECHO_SCRIPT = `printf 'arguments:%s\\n' "$*"\nprintf 'standard input:'\ncat`;

describe('RawCodingAgent.run', () => {
	const fakeCommands = new FakeCommands();

	afterEach(() => {
		fakeCommands.uninstall();
	});

	describe('with fake commands that echo their arguments and their standard input', () => {
		beforeEach(() => {
			fakeCommands.install({
				claude: ECHO_SCRIPT,
				codex: ECHO_SCRIPT,
			});
		});

		it('runs "claude -p" and sends the prompt on the standard input', async () => {
			const answer = await RawCodingAgent.run({
				prompt: 'the prompt text',
				agentName: 'claude',
			});
			expect(answer).toBe('arguments:-p\nstandard input:the prompt text');
		});

		it('runs "codex exec" and sends the prompt on the standard input', async () => {
			const answer = await RawCodingAgent.run({
				prompt: 'the prompt text',
				agentName: 'codex',
			});
			expect(answer).toBe('arguments:exec --skip-git-repo-check -\nstandard input:the prompt text');
		});

		it('sends a prompt larger than the limit of the command line', async () => {
			const prompt = 'x'.repeat(2_000_000);
			const answer = await RawCodingAgent.run({
				prompt,
				agentName: 'claude',
			});
			expect(answer).toBe(`arguments:-p\nstandard input:${prompt}`);
		});
	});

	it('throws a clear error when the command is not installed', async () => {
		fakeCommands.install({}, true);
		await expect(RawCodingAgent.run({
			prompt: 'the prompt text',
			agentName: 'claude',
		})).rejects.toThrow('The command "claude" is not installed or is not in the PATH.');
	});

	it('throws an error with the standard error output when the command exits with an error code', async () => {
		fakeCommands.install({
			codex: `echo 'something broke' >&2\nexit 3`,
		});
		await expect(RawCodingAgent.run({
			prompt: 'the prompt text',
			agentName: 'codex',
		})).rejects.toThrow('The command "codex" failed with exit code 3.\nsomething broke');
	});
});
