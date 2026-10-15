import Fs from 'node:fs';
import Http from 'node:http';
import Os from 'node:os';
import Path from 'node:path';
import type { Plugin, ProxyOptions, UserConfig, ViteDevServer } from 'vite';
import { DevApi } from './dev_api';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DevServerPlugin — answers `/api` in the development server, with a fake Mac or the real application
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The plugin of the development server of the mobile website. It works only for `vite` (the command `serve`), never
 * for `vite build`, so nothing of this folder reaches the built website.
 */
export class DevServerPlugin {
	/** The biggest body of a call that the fake Mac accepts, in bytes. */
	private static readonly maxBodyBytes = 64 * 1024;

	/**
	 * Builds the plugin.
	 * @param realTarget The address of the mobile server of the desktop application, for example
	 * `http://127.0.0.1:47823`, or null to answer with the fake Mac.
	 * @returns The plugin.
	 */
	static create(realTarget: string | null): Plugin {
		const devApi = new DevApi();
		return {
			name: 'mobile-website-dev-api',
			apply: 'serve',
			config() {
				return realTarget === null ? {} : DevServerPlugin.proxyConfig(realTarget);
			},
			configureServer(server) {
				if (realTarget === null) {
					server.middlewares.use('/api', (request, response) => {
						void DevServerPlugin.answer(devApi, request, response);
					});
				}
				const printUrls = server.printUrls.bind(server);
				server.printUrls = () => {
					printUrls();
					DevServerPlugin.printPairedAddress(server, realTarget);
				};
			},
		};
	}

	private static proxyConfig(realTarget: string): UserConfig {
		const apiProxy: ProxyOptions = {
			target: realTarget,
			changeOrigin: true,
			configure: (proxy) => {
				proxy.on('proxyReq', (proxyRequest) => {
					// The mobile server refuses an origin that is not its own address.
					proxyRequest.setHeader('origin', realTarget);
				});
			},
		};
		return {
			server: {
				proxy: {
					'/api': apiProxy,
				},
			},
		};
	}

	private static async answer(
		devApi: DevApi,
		request: Http.IncomingMessage,
		response: Http.ServerResponse,
	): Promise<void> {
		if (request.method !== 'POST') {
			response.statusCode = 405;
			response.end('POST only');
			return;
		}
		const chunks: Buffer[] = [];
		let size = 0;
		for await (const chunk of request) {
			size += (chunk as Buffer).length;
			if (size > DevServerPlugin.maxBodyBytes) {
				response.statusCode = 413;
				response.end('Request too large');
				return;
			}
			chunks.push(chunk as Buffer);
		}
		const header = request.headers['x-herdr-token'];
		const body = Buffer.concat(chunks).toString('utf8');
		const reply = devApi.handle(typeof header === 'string' ? header : null, body);
		response.statusCode = reply.status;
		response.setHeader('content-type', typeof reply.body === 'string' ? 'text/plain' : 'application/json');
		response.setHeader('cache-control', 'no-store');
		response.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body));
	}

	private static printPairedAddress(server: ViteDevServer, realTarget: string | null): void {
		const address = server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:5183/';
		if (realTarget === null) {
			console.log(`  ➜  Fake Mac: open ${address}#t=${DevApi.pairingKey}`);
			return;
		}
		const key = DevServerPlugin.readRealPairingKey();
		const hashText = key === null ? '' : `#t=${key}`;
		console.log(`  ➜  Real desktop application at ${realTarget}: open ${address}${hashText}`);
		if (key === null) {
			console.log('     The file mobile.json has no pairing key: turn the mobile access on first.');
		}
	}

	private static readRealPairingKey(): string | null {
		const folder = process.env.HEIDRUN_DIR ?? Path.join(Os.homedir(), '.config', 'heidrun');
		try {
			const text = Fs.readFileSync(Path.join(folder, 'mobile.json'), 'utf8');
			const token = (JSON.parse(text) as { token?: unknown }).token;
			return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token) ? token : null;
		} catch {
			return null;
		}
	}
}
