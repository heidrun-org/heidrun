import { defineConfig } from 'vitest/config';

export default defineConfig({
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
