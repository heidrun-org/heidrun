import { defineConfig } from 'vitest/config';
import { DevServerPlugin } from './dev/dev_server_plugin';

// `pnpm --filter mobile_website dev` answers `/api` with a fake Mac. With `MOBILE_API_TARGET` set to the address
// of the mobile server of the desktop application, it sends `/api` to the real application instead.
export default defineConfig({
	plugins: [DevServerPlugin.create(process.env.MOBILE_API_TARGET ?? null)],
	server: {
		host: '127.0.0.1',
		port: 5183,
		strictPort: true,
	},
	build: {
		// The iPhone and the iPad run Safari 16 or later.
		target: 'safari16',
		sourcemap: false,
		// The page runs under a content security policy that allows only files of its own address: no inline
		// script.
		modulePreload: {
			polyfill: false,
		},
	},
	test: {
		environment: 'jsdom',
		include: ['tests/**/*.test.ts'],
		setupFiles: ['tests/setup.ts'],
	},
});
