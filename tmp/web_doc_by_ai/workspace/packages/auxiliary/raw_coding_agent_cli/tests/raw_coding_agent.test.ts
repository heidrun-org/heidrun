import Fs from 'node:fs';
import Os from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RawCodingAgent } from '../src/index.ts';
import { ECHO_SCRIPT, FakeCommands } from './fake_commands.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

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

		it('runs "claude -p" with the permission to edit files when isEditAllowed is true', async () => {
			const answer = await RawCodingAgent.run({
				prompt: 'the prompt text',
				agentName: 'claude',
				isEditAllowed: true,
			});
			expect(answer).toBe(
				'arguments:-p --permission-mode acceptEdits --allowedTools '
					+ 'Bash(git log:*),Bash(git diff:*),Bash(git show:*),Bash(gh issue view:*)\nstandard input:the prompt text',
			);
		});

		it('runs "codex exec" with a sandbox that can write when isEditAllowed is true', async () => {
			const answer = await RawCodingAgent.run({
				prompt: 'the prompt text',
				agentName: 'codex',
				isEditAllowed: true,
			});
			expect(answer).toBe(
				'arguments:exec --skip-git-repo-check --sandbox workspace-write -\nstandard input:the prompt text',
			);
		});

		it('passes the model and the effort to claude', async () => {
			const answer = await RawCodingAgent.run({
				prompt: 'the prompt text',
				agentName: 'claude',
				model: 'opus',
				effort: 'high',
			});
			expect(answer).toBe('arguments:-p --model opus --effort high\nstandard input:the prompt text');
		});

		it('passes the model and the effort to codex', async () => {
			const answer = await RawCodingAgent.run({
				prompt: 'the prompt text',
				agentName: 'codex',
				model: 'gpt-5-codex',
				effort: 'high',
			});
			expect(answer).toBe(
				'arguments:exec --skip-git-repo-check --model gpt-5-codex -c model_reasoning_effort="high" -\n'
					+ 'standard input:the prompt text',
			);
		});

		it('runs the command in the working directory when one is given', async () => {
			fakeCommands.install({
				claude: 'pwd',
			});
			const workingDirectory = Fs.realpathSync(Os.tmpdir());
			const answer = await RawCodingAgent.run({
				prompt: 'the prompt text',
				agentName: 'claude',
				workingDirectory,
			});
			expect(answer).toBe(workingDirectory);
		});

		it('streams the progress of claude and returns the final answer when onProgress is given', async () => {
			fakeCommands.install({
				claude: [
					`printf '%s\\n' '{"type":"system","subtype":"init"}'`,
					`printf '%s\\n' '{"type":"assistant","message":{"content":[{"type":"text","text":"I read the rule.\\nMore."},{"type":"tool_use","name":"Read","input":{"file_path":"a.md"}}]}}'`,
					`printf '%s\\n' '{"type":"result","subtype":"success","result":"the final answer"}'`,
				].join('\n'),
			});
			const messages: string[] = [];
			const answer = await RawCodingAgent.run({
				prompt: 'the prompt text',
				agentName: 'claude',
				onProgress: (message) => {
					messages.push(message);
				},
			});
			expect(answer).toBe('the final answer');
			expect(messages).toEqual(['I read the rule.', 'Read a.md']);
		});

		it('sends the lines of the standard error output of codex as progress', async () => {
			fakeCommands.install({
				codex: `echo 'step one' >&2\necho 'the answer'`,
			});
			const messages: string[] = [];
			const answer = await RawCodingAgent.run({
				prompt: 'the prompt text',
				agentName: 'codex',
				onProgress: (message) => {
					messages.push(message);
				},
			});
			expect(answer).toBe('the answer');
			expect(messages).toEqual(['step one']);
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
