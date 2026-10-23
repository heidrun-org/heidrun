// @vitest-environment node
import Http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { DevApi } from '../dev/dev_api';
import { DevServerPlugin } from '../dev/dev_server_plugin';

type Reply = {
	status: number;
	text: string;
};

const cleanups: Array<() => Promise<void>> = [];

describe('Pairing lines of the development server', () => {
	it('prints the pairing link of the fake computer for the local address and the network address', () => {
		const addresses = ['http://localhost:5183/', 'http://192.168.1.160:5183/'];
		const lines = DevServerPlugin.pairingLines(addresses, null, null);
		expect(lines).toEqual([
			`  ➜  Fake computer: open http://localhost:5183/#t=${DevApi.pairingKey}`,
			`  ➜  Fake computer: open http://192.168.1.160:5183/#t=${DevApi.pairingKey}`,
		]);
	});

	it('prints the pairing link of the real application, with its own key', () => {
		const key = 'ab'.repeat(32);
		const target = 'http://127.0.0.1:47823';
		const lines = DevServerPlugin.pairingLines(['http://192.168.1.160:5183/'], target, key);
		expect(lines).toEqual([
			`  ➜  Real desktop application at ${target}: open http://192.168.1.160:5183/#t=${key}`,
		]);
	});

	it('says to turn the mobile access on when the real application has no pairing key', () => {
		const lines = DevServerPlugin.pairingLines(['http://localhost:5183/'], 'http://127.0.0.1:47823', null);
		expect(lines).toHaveLength(2);
		expect(lines[0]).not.toContain('#t=');
		expect(lines[1]).toContain('turn the mobile access on first');
	});
});

const startVite = async (realTarget: string | null, tunnelHost: string | null = null): Promise<number> => {
	const server: ViteDevServer = await createServer({
		configFile: false,
		root: process.cwd(),
		logLevel: 'silent',
		plugins: [DevServerPlugin.create(realTarget, tunnelHost)],
		server: {
			host: '127.0.0.1',
			port: 0,
		},
	});
	await server.listen();
	cleanups.push(() => server.close());
	return (server.httpServer?.address() as AddressInfo).port;
};

const post = (port: number, method: string, headers: Record<string, string>, body: string): Promise<Reply> => {
	return new Promise((resolve, reject) => {
		const request = Http.request(
			{
				host: '127.0.0.1',
				port,
				path: '/api',
				method,
				headers,
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on('data', (chunk: Buffer) => chunks.push(chunk));
				response.on('end', () => {
					resolve({
						status: response.statusCode ?? 0,
						text: Buffer.concat(chunks).toString('utf8'),
					});
				});
			},
		);
		request.on('error', reject);
		request.end(body);
	});
};

afterEach(async () => {
	while (cleanups.length > 0) {
		await cleanups.pop()?.();
	}
});

describe('DevServerPlugin with the fake computer', () => {
	it('answers a call of the page on /api', async () => {
		const port = await startVite(null);
		const reply = await post(port, 'POST', { 'x-herdr-token': DevApi.pairingKey }, '{"method":"state"}');
		expect(reply.status).toBe(200);
		expect(JSON.parse(reply.text).workspaces).toHaveLength(1);
	});

	it('refuses a call with no pairing key, and a method other than POST', async () => {
		const port = await startVite(null);
		expect((await post(port, 'POST', {}, '{"method":"state"}')).status).toBe(401);
		expect((await post(port, 'GET', {}, '')).status).toBe(405);
	});

	it('refuses a body that is too large', async () => {
		const port = await startVite(null);
		const body = JSON.stringify({
			method: 'state',
			padding: 'x'.repeat(70 * 1024),
		});
		const reply = await post(port, 'POST', { 'x-herdr-token': DevApi.pairingKey }, body);
		expect(reply.status).toBe(413);
	});
});

describe('DevServerPlugin with the real desktop application', () => {
	it('sends /api to the mobile server, with the host and the origin of the mobile server', async () => {
		const seen: Array<Record<string, string | string[] | undefined>> = [];
		const upstream = Http.createServer((request, response) => {
			seen.push(request.headers);
			response.setHeader('content-type', 'application/json');
			response.end('{"answer":"from the real application"}');
		});
		await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
		cleanups.push(() => new Promise<void>((resolve) => upstream.close(() => resolve())));
		const upstreamPort = (upstream.address() as AddressInfo).port;
		const target = `http://127.0.0.1:${upstreamPort}`;
		const vitePort = await startVite(target);
		const reply = await post(
			vitePort,
			'POST',
			{
				'x-herdr-token': 'c'.repeat(64),
				origin: `http://127.0.0.1:${vitePort}`,
			},
			'{"method":"state"}',
		);
		expect(JSON.parse(reply.text)).toEqual({
			answer: 'from the real application',
		});
		expect(seen).toHaveLength(1);
		expect(seen[0].host).toBe(`127.0.0.1:${upstreamPort}`);
		expect(seen[0].origin).toBe(target);
		expect(seen[0]['x-herdr-token']).toBe('c'.repeat(64));
	});

	it('sends the host name of the tunnel in the headers host and origin, when it is given', async () => {
		const seen: Array<Record<string, string | string[] | undefined>> = [];
		const upstream = Http.createServer((request, response) => {
			seen.push(request.headers);
			response.setHeader('content-type', 'application/json');
			response.end('{"answer":"from the real application"}');
		});
		await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
		cleanups.push(() => new Promise<void>((resolve) => upstream.close(() => resolve())));
		const upstreamPort = (upstream.address() as AddressInfo).port;
		const vitePort = await startVite(`http://127.0.0.1:${upstreamPort}`, 'words-of-the-tunnel.ngrok-free.dev');
		await post(
			vitePort,
			'POST',
			{
				'x-herdr-token': 'c'.repeat(64),
				origin: `http://127.0.0.1:${vitePort}`,
			},
			'{"method":"state"}',
		);
		expect(seen).toHaveLength(1);
		expect(seen[0].host).toBe('words-of-the-tunnel.ngrok-free.dev');
		expect(seen[0].origin).toBe('https://words-of-the-tunnel.ngrok-free.dev');
		expect(seen[0]['x-herdr-token']).toBe('c'.repeat(64));
	});
});
