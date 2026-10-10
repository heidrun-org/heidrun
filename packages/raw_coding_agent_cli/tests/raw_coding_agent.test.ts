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
