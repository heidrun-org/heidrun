import { defineConfig } from 'vitest/config';

// The page of the experiment is index.html. The base "./" makes every address of the build relative, so the folder
// of the build works in any place of a server of static files. The page reads the file commits.json next to it.
export default defineConfig({
	base: './',
	build: {
		rollupOptions: {
			// Zod puts a comment that Rollup cannot read. The comment changes nothing, so the build hides this warning.
			onwarn(warning, warn) {
				if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('zod') === true) {
					return;
				}
				warn(warning);
			},
		},
	},
	server: {
		port: 5181,
	},
	test: {
		include: ['tests/**/*.test.ts'],
	},
});
