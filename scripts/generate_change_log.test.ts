import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TestRepository } from './change_log/test_repository.ts';
import { GenerateChangeLog } from './generate_change_log.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Helpers
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The result of one run of the script in a new process.
 */
type ScriptResult = {
	/** The text printed on the standard output. */
	stdout: string;
	/** The text printed on the standard error output. */
	stderr: string;
	/** The exit code of the script. */
	exitCode: number | null;
};

/**
 * Runs the script `scripts/generate_change_log.ts` in a new process, with fake `codex` and `claude` commands.
 */
class ScriptRunner {
	/** The folders of fake commands that the class created and did not remove yet. */
	private static _fakeFolders: string[] = [];

	/**
	 * Runs the script.
	 * @param repositoryPath The folder to run the script in.
	 * @param args The arguments of the script.
	 * @param promptFilePath The file where a fake coding agent writes the prompt that it receives.
	 * @returns The standard output, the standard error output, and the exit code.
	 */
	static run(repositoryPath: string, args: string[], promptFilePath: string): ScriptResult {
		const fakeFolder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'change_log_fake_agents_'));
		ScriptRunner._fakeFolders.push(fakeFolder);
		for (const agentName of ['codex', 'claude']) {
			const commandPath = Path.join(fakeFolder, agentName);
			Fs.writeFileSync(commandPath, [
				'#!/bin/sh',
				'cat > "$PROMPT_FILE"',
				'cat <<\'END\'',
				'```markdown',
				'## Unreleased',
				'',
				`### Added`,
				'',
				`- A change written by the fake ${agentName}. ([#7](https://github.com/acme/widgets/pull/7))`,
				'```',
				'END',
				'',
			].join('\n'));
			Fs.chmodSync(commandPath, 0o755);
		}
		const tsxPath = Path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
		const scriptPath = Path.join(__dirname, 'generate_change_log.ts');
		const result = ChildProcess.spawnSync(tsxPath, [scriptPath, ...args], {
			cwd: repositoryPath,
			encoding: 'utf8',
			input: '',
			env: {
				...process.env,
				PATH: `${fakeFolder}${Path.delimiter}${process.env.PATH}`,
				PROMPT_FILE: promptFilePath,
			},
		});
		return {
			stdout: result.stdout,
			stderr: result.stderr,
			exitCode: result.status,
		};
	}

	/**
	 * Removes all the folders of fake commands that the class created.
	 * @returns Nothing.
	 */
	static removeAll(): void {
		for (const fakeFolder of ScriptRunner._fakeFolders.splice(0)) {
			Fs.rmSync(fakeFolder, { recursive: true, force: true });
		}
	}
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const MECHANICAL_SECTION = [
	'## [Unreleased]',
	'',
	'- Fix the bug ([#8](https://github.com/acme/widgets/pull/8))',
	'- Add the thing ([#7](https://github.com/acme/widgets/pull/7))',
].join('\n');

describe('GenerateChangeLog', () => {
	afterEach(() => {
		TestRepository.removeAll();
		ScriptRunner.removeAll();
	});

	describe('run, without a coding agent', () => {
		it('writes CHANGELOG.md with the header and the pull requests merged after the last release', async () => {
			const repositoryPath = TestRepository.createWithRelease();
			const section = await GenerateChangeLog.run({
				repositoryPath,
				isAi: false,
				agentName: undefined,
			});
			expect(section).toBe(MECHANICAL_SECTION);
			const text = Fs.readFileSync(Path.join(repositoryPath, 'CHANGELOG.md'), 'utf8');
			expect(text.startsWith('# Changelog\n')).toBe(true);
			expect(text.endsWith(`\n\n${MECHANICAL_SECTION}\n`)).toBe(true);
			expect(text).not.toContain('Do the old work');
		});

		it('does not change the older sections of an existing CHANGELOG.md', async () => {
			const repositoryPath = TestRepository.createWithRelease();
			const olderSections = [
				'## [1.0.0] - 2026-01-01',
				'',
				'### Added',
				'',
				'- The first version. (#3)',
				'',
				'[1.0.0]: https://example.com',
				'',
			].join('\n');
			Fs.writeFileSync(Path.join(repositoryPath, 'CHANGELOG.md'), `# Changelog\n\nMy own words.\n\n${olderSections}`);
			await GenerateChangeLog.run({
				repositoryPath,
				isAi: false,
				agentName: undefined,
			});
			const text = Fs.readFileSync(Path.join(repositoryPath, 'CHANGELOG.md'), 'utf8');
			expect(text).toBe(`# Changelog\n\nMy own words.\n\n${MECHANICAL_SECTION}\n\n${olderSections}`);
		});

		it('gives the same file when it runs twice', async () => {
			const repositoryPath = TestRepository.createWithRelease();
			const runOptions = {
				repositoryPath,
				isAi: false,
				agentName: undefined,
			};
			await GenerateChangeLog.run(runOptions);
			const firstText = Fs.readFileSync(Path.join(repositoryPath, 'CHANGELOG.md'), 'utf8');
			await GenerateChangeLog.run(runOptions);
			expect(Fs.readFileSync(Path.join(repositoryPath, 'CHANGELOG.md'), 'utf8')).toBe(firstText);
		});

		it('throws an error when the agent is given without the option ai', async () => {
			const repositoryPath = TestRepository.createWithRelease();
			await expect(GenerateChangeLog.run({
				repositoryPath,
				isAi: false,
				agentName: 'claude',
			})).rejects.toThrow('The option --agent needs the option --ai.');
		});
	});

	describe('run, with a coding agent', () => {
		it('sends the prompt with the merged pull requests and writes the answer in CHANGELOG.md', async () => {
			const repositoryPath = TestRepository.createWithRelease();
			const calls: { prompt: string; agentName: string }[] = [];
			const section = await GenerateChangeLog.run({
				repositoryPath,
				isAi: true,
				agentName: undefined,
				runAgentFn: async (prompt, agentName) => {
					calls.push({ prompt, agentName });
					return '## [Unreleased]\n\n### Added\n\n- A thing. ([#7](https://github.com/acme/widgets/pull/7))';
				},
			});
			expect(calls).toHaveLength(1);
			expect(calls[0].agentName).toBe('codex');
			expect(calls[0].prompt).toContain('since the release v1.0.0');
			expect(calls[0].prompt).toContain('Merge pull request #8 from acme/fix-bug\n\nFix the bug');
			expect(calls[0].prompt).toContain('Merge pull request #7 from acme/add-thing\n\nAdd the thing');
			expect(calls[0].prompt).not.toContain('#3 from acme/old-work');
			expect(section).toBe('## [Unreleased]\n\n### Added\n\n- A thing. ([#7](https://github.com/acme/widgets/pull/7))');
			const text = Fs.readFileSync(Path.join(repositoryPath, 'CHANGELOG.md'), 'utf8');
			expect(text.endsWith(`\n\n${section}\n`)).toBe(true);
		});

		it('passes the name of the coding agent that the caller chooses', async () => {
			const repositoryPath = TestRepository.createWithRelease();
			let receivedAgentName = '';
			await GenerateChangeLog.run({
				repositoryPath,
				isAi: true,
				agentName: 'claude',
				runAgentFn: async (_prompt, agentName) => {
					receivedAgentName = agentName;
					return '## [Unreleased]\n\n- A thing.';
				},
			});
			expect(receivedAgentName).toBe('claude');
		});

		it('does not write the file when the answer is not a section', async () => {
			const repositoryPath = TestRepository.createWithRelease();
			await expect(GenerateChangeLog.run({
				repositoryPath,
				isAi: true,
				agentName: undefined,
				runAgentFn: async () => {
					return 'Sorry, I cannot do that.';
				},
			})).rejects.toThrow('did not answer with a section of the change log');
			expect(Fs.existsSync(Path.join(repositoryPath, 'CHANGELOG.md'))).toBe(false);
		});
	});

	describe('the script in a new process', () => {
		it('prints the new section on the standard output, and writes the file', () => {
			const repositoryPath = TestRepository.createWithRelease();
			const result = ScriptRunner.run(repositoryPath, [], Path.join(repositoryPath, 'prompt.txt'));
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe(`${MECHANICAL_SECTION}\n`);
			expect(Fs.readFileSync(Path.join(repositoryPath, 'CHANGELOG.md'), 'utf8')).toContain(MECHANICAL_SECTION);
		});

		it('runs the real package raw_coding_agent_cli with the option --ai, with codex by default', () => {
			const repositoryPath = TestRepository.createWithRelease();
			const promptFilePath = Path.join(Os.tmpdir(), `change_log_prompt_${process.pid}_codex.txt`);
			const result = ScriptRunner.run(repositoryPath, ['--ai'], promptFilePath);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('- A change written by the fake codex.');
			expect(result.stdout.startsWith('## [Unreleased]\n')).toBe(true);
			const prompt = Fs.readFileSync(promptFilePath, 'utf8');
			Fs.rmSync(promptFilePath);
			expect(prompt).toContain('Merge pull request #7 from acme/add-thing');
			expect(Fs.readFileSync(Path.join(repositoryPath, 'CHANGELOG.md'), 'utf8')).toContain('fake codex');
		});

		it('runs claude with the options --ai --agent claude', () => {
			const repositoryPath = TestRepository.createWithRelease();
			const promptFilePath = Path.join(Os.tmpdir(), `change_log_prompt_${process.pid}_claude.txt`);
			const result = ScriptRunner.run(repositoryPath, ['--ai', '--agent', 'claude'], promptFilePath);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('- A change written by the fake claude.');
			Fs.rmSync(promptFilePath, { force: true });
		});

		it('exits with code 1 for an unknown coding agent, and does not write the file', () => {
			const repositoryPath = TestRepository.createWithRelease();
			const promptFilePath = Path.join(repositoryPath, 'prompt.txt');
			const result = ScriptRunner.run(repositoryPath, ['--ai', '--agent', 'gemini'], promptFilePath);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Unknown coding agent "gemini". Use codex or claude.');
			expect(Fs.existsSync(Path.join(repositoryPath, 'CHANGELOG.md'))).toBe(false);
		});

		it('exits with code 1 when the option --agent is given without the option --ai', () => {
			const repositoryPath = TestRepository.createWithRelease();
			const result = ScriptRunner.run(repositoryPath, ['--agent', 'claude'], Path.join(repositoryPath, 'prompt.txt'));
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('The option --agent needs the option --ai.');
		});
	});
});
