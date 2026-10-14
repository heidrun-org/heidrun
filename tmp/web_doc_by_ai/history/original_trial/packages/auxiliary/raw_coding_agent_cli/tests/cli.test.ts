import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ECHO_SCRIPT, FakeCommands } from './fake_commands.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Helpers
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The result of one run of the command line.
 */
type CliResult = {
	/** The text printed on the standard output. */
	stdout: string;
	/** The text printed on the standard error output. */
	stderr: string;
	/** The exit code of the command line. */
	exitCode: number | null;
};

/**
 * Runs the command line `src/cli.ts` in a new process, the same way the executable `raw_coding_agent_cli` runs.
 */
class CliRunner {
	/**
	 * Runs the command line and waits for it to exit.
	 * @param args The arguments of the command line.
	 * @param stdinText The text to write on the standard input. The standard input is closed after the text.
	 * @returns The standard output, the standard error output, and the exit code.
	 */
	static run(args: string[], stdinText: string = ''): CliResult {
		const tsxPath = Path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
		const cliPath = Path.join(__dirname, '..', 'src', 'cli.ts');
		const result = ChildProcess.spawnSync(tsxPath, [cliPath, ...args], {
			input: stdinText,
			encoding: 'utf8',
		});
		return {
			stdout: result.stdout,
			stderr: result.stderr,
			exitCode: result.status,
		};
	}
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('raw_coding_agent_cli', () => {
	const fakeCommands = new FakeCommands();
	const packageJson = JSON.parse(Fs.readFileSync(Path.join(__dirname, '..', 'package.json'), 'utf8'));

	beforeEach(() => {
		fakeCommands.install({
			claude: ECHO_SCRIPT,
			codex: ECHO_SCRIPT,
		});
	});

	afterEach(() => {
		fakeCommands.uninstall();
	});

	describe('version and help', () => {
		it.each(['-v', '--version'])('prints the version of the package with %s', (flag) => {
			const result = CliRunner.run([flag]);
			expect(result.exitCode).toBe(0);
			expect(result.stdout.trim()).toBe(packageJson.version);
		});

		it.each(['-h', '--help'])('prints the help text with %s', (flag) => {
			const result = CliRunner.run([flag]);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('Usage: raw_coding_agent_cli [options] [prompt]');
			expect(result.stdout).toContain('-a, --agent <name>');
			expect(result.stdout.replace(/\s+/g, ' ')).toContain('(choices: "codex", "claude", default: "codex")');
			expect(result.stdout).toContain('-f, --prompt-file <path>');
			expect(result.stdout).toContain('-v, --version');
			expect(result.stdout).toContain('Exit codes:');
			expect(result.stdout).toContain('Examples:');
		});
	});

	describe('prompt on the command line', () => {
		it('runs codex by default and prints the answer', () => {
			const result = CliRunner.run(['the prompt text']);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe('arguments:exec --skip-git-repo-check -\nstandard input:the prompt text\n');
		});

		it.each(['-a', '--agent'])('runs claude with %s claude', (flag) => {
			const result = CliRunner.run([flag, 'claude', 'the prompt text']);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe('arguments:-p\nstandard input:the prompt text\n');
		});

		it('adds the standard input after the prompt, with a blank line between them', () => {
			const result = CliRunner.run(['Summarize these commits:'], 'commit one\ncommit two\n');
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('standard input:Summarize these commits:\n\ncommit one\ncommit two\n');
		});
	});

	describe('prompt in a file', () => {
		let folder: string = '';

		beforeEach(() => {
			folder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'raw_coding_agent_cli_test_'));
		});

		afterEach(() => {
			Fs.rmSync(folder, { recursive: true, force: true });
		});

		it.each(['-f', '--prompt-file'])('reads the prompt from the file given with %s', (flag) => {
			const promptFilePath = Path.join(folder, 'prompt.md');
			Fs.writeFileSync(promptFilePath, 'a long prompt\nwith two lines\n');
			const result = CliRunner.run([flag, promptFilePath]);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('standard input:a long prompt\nwith two lines\n');
		});

		it('exits with code 1 when the file does not exist', () => {
			const result = CliRunner.run(['--prompt-file', Path.join(folder, 'missing.md')]);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Cannot read the prompt file');
		});

		it('exits with code 1 when a prompt argument and a prompt file are both given', () => {
			const promptFilePath = Path.join(folder, 'prompt.md');
			Fs.writeFileSync(promptFilePath, 'a long prompt');
			const result = CliRunner.run(['--prompt-file', promptFilePath, 'the prompt text']);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Give a prompt argument or the option --prompt-file, not both.');
		});
	});

	describe('errors', () => {
		it('exits with code 1 when there is no prompt at all', () => {
			const result = CliRunner.run([]);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('No prompt.');
			expect(result.stdout).toBe('');
		});

		it('exits with code 1 when the agent name is not known', () => {
			const result = CliRunner.run(['--agent', 'gemini', 'the prompt text']);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Allowed choices are codex, claude.');
		});

		it('exits with code 1 and prints the standard error output of a failing coding agent', () => {
			fakeCommands.uninstall();
			fakeCommands.install({
				codex: `echo 'something broke' >&2\nexit 3`,
			});
			const result = CliRunner.run(['the prompt text']);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('The command "codex" failed with exit code 3.\nsomething broke');
		});
	});
});
