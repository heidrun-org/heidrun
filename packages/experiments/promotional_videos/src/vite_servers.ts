import Net from 'node:net';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ViteServers — starts a Vite server of a package of this repository on a free port
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A running Vite server and the address of its page.
 */
export type RunningViteServer = {
	/** The server. Close it when the recording is done. */
	server: ViteDevServer;
	/** The address of the page, for example `http://127.0.0.1:50321`. */
	address: string;
};

/**
 * Starts a Vite server for a package of this repository, so a headless browser can open the page of the package. The
 * server listens on the loopback address and on a free port, so it never takes the port of a server that the developer
 * started.
 */
export class ViteServers {
	/**
	 * Starts the server of a package.
	 * @param rootFolder The folder of the package, with its own Vite configuration.
	 * @returns The server and the address of its page.
	 */
	static async start(rootFolder: string): Promise<RunningViteServer> {
		const port = await ViteServers._findFreePort();
		const server = await createServer({
			root: rootFolder,
			logLevel: 'silent',
			server: {
				host: '127.0.0.1',
				port,
				strictPort: true,
				open: false,
			},
		});
		await server.listen();
		const runningViteServer: RunningViteServer = {
			server,
			address: `http://127.0.0.1:${port}`,
		};
		return runningViteServer;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Asks the system for a free port.
	 * @returns The port.
	 */
	private static async _findFreePort(): Promise<number> {
		return new Promise<number>((resolve, reject) => {
			const probe = Net.createServer();
			probe.on('error', reject);
			probe.listen(0, '127.0.0.1', () => {
				const probeAddress = probe.address();
				if (probeAddress === null || typeof probeAddress === 'string') {
					reject(new Error('The system gave no port.'));
					return;
				}
				probe.close(() => {
					resolve(probeAddress.port);
				});
			});
		});
	}
}
