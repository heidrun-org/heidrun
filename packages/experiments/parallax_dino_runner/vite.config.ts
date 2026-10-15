import { defineConfig } from 'vitest/config';

// The page of the experiment is index.html. The game needs no data file.
export default defineConfig({
	server: {
		port: 5181,
	},
	test: {
		include: ['tests/**/*.test.ts'],
	},
});
