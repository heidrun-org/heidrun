import { defineConfig } from 'vitest/config';

// The page of the experiment is index.html. It reads public/graph.json, which the script graph:build writes.
export default defineConfig({
	server: {
		port: 5180,
	},
	test: {
		include: ['tests/**/*.test.ts'],
		testTimeout: 30000,
	},
});
