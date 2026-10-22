import { describe, expect, it } from 'vitest';
import { DevApi } from '../dev/dev_api';
import type { CallResult, Snapshot } from '../src/mobile_types';

const key = DevApi.pairingKey;

const call = (devApi: DevApi, method: string, params: Record<string, unknown> = {}): unknown => {
	const reply = devApi.handle(
		key,
		JSON.stringify({
			method,
			params,
		}),
	);
	expect(reply.status).toBe(200);
	return reply.body;
};

describe('DevApi', () => {
	it('refuses a call with no pairing key, or with a key that is not 64 hexadecimal characters', () => {
		const devApi = new DevApi();
		expect(devApi.handle(null, '{"method":"state"}').status).toBe(401);
		expect(devApi.handle('abc', '{"method":"state"}').status).toBe(401);
		expect(devApi.handle('g'.repeat(64), '{"method":"state"}').status).toBe(401);
	});

	it('accepts any valid pairing key, so a phone that is already paired keeps working', () => {
		expect(new DevApi().handle('f'.repeat(64), '{"method":"state"}').status).toBe(200);
	});

	it('refuses a body that is not JSON, and a method that is not in the closed list', () => {
		const devApi = new DevApi();
		expect(devApi.handle(key, 'not json')).toEqual({
			status: 400,
			body: 'Invalid request',
		});
		expect(devApi.handle(key, '{"method":"shutdown"}')).toEqual({
			status: 400,
			body: 'Unknown method',
		});
		expect(devApi.handle(key, '{}').status).toBe(400);
	});

	it('answers `state` with four coding agents and one plain terminal, and puts the ones that need the developer in attention', () => {
		const snapshot = call(new DevApi(), 'state') as Snapshot;
		const agents = snapshot.workspaces.flatMap((workspace) => workspace.agents);
		const paneIds = agents.map((agent) => agent.paneId).sort();
		expect(paneIds).toEqual(['p-asking', 'p-blocked', 'p-finished', 'p-terminal', 'p-working']);
		expect([...snapshot.attention].sort()).toEqual(['p-asking', 'p-blocked']);
		expect(snapshot.quotas.length).toBeGreaterThan(0);
	});

	it('answers `read` with a screen that has color codes', () => {
		const result = call(new DevApi(), 'read', { paneId: 'p-working' }) as CallResult;
		expect(result.text).toContain('\u001b[');
		expect(result.text).toContain('Codex');
	});

	it('tells that a pane does not exist when the identifier is unknown', () => {
		expect(call(new DevApi(), 'read', { paneId: 'p-nowhere' })).toEqual({
			error: 'This pane does not exist anymore.',
		});
	});

	it('shows the prompts of the developer in the output of the pane, and makes the coding agent work', () => {
		const devApi = new DevApi();
		expect(call(devApi, 'prompt', { paneId: 'p-finished', text: 'run the tests' })).toEqual({
			ok: true,
		});
		const result = call(devApi, 'read', { paneId: 'p-finished' }) as CallResult;
		expect(result.text).toContain('run the tests');
		const snapshot = call(devApi, 'state') as Snapshot;
		const agent = snapshot.workspaces[0].agents.find((candidate) => candidate.paneId === 'p-finished');
		expect(agent?.status).toBe('working');
	});

	it('asks to check a dangerous command once more, and runs it after the confirmation', () => {
		const devApi = new DevApi();
		const first = call(devApi, 'answer', { paneId: 'p-blocked', n: 1 }) as CallResult;
		expect(first.confirm?.command).toBe('rm -rf build');
		const second = call(devApi, 'answer', {
			paneId: 'p-blocked',
			n: 1,
			confirmed: true,
			command: 'rm -rf build',
		}) as CallResult;
		expect(second).toEqual({
			ok: true,
		});
		const snapshot = call(devApi, 'state') as Snapshot;
		expect(snapshot.attention).not.toContain('p-blocked');
	});

	it('answers "No" with no confirmation, and accepts the stop keys', () => {
		const devApi = new DevApi();
		expect(call(devApi, 'answer', { paneId: 'p-blocked', n: 3 })).toEqual({
			ok: true,
		});
		expect(call(devApi, 'keys', { paneId: 'p-working', action: 'interrupt' })).toEqual({
			ok: true,
		});
	});
});
