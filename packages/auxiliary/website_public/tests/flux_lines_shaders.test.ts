import { describe, expect, it } from 'vitest';
import { FluxLinesShaders } from '../docs/.vitepress/theme/flux_lines_shaders';

describe('FluxLinesShaders', () => {
	it('writes both shaders for WebGL2', () => {
		expect(FluxLinesShaders.VERTEX.startsWith('#version 300 es')).toBe(true);
		expect(FluxLinesShaders.FRAGMENT.startsWith('#version 300 es')).toBe(true);
	});

	it('gives the fragment shader room for the maximum number of colors', () => {
		expect(FluxLinesShaders.FRAGMENT).toContain(`uniform vec3 uColors[${FluxLinesShaders.MAX_COLORS}];`);
	});

	it('includes the noise functions in the fragment shader', () => {
		expect(FluxLinesShaders.FRAGMENT).toContain(FluxLinesShaders.NOISE_FUNCTIONS);
	});

	it('writes a transparent background: no uniform asks for an opaque background', () => {
		expect(FluxLinesShaders.FRAGMENT).not.toContain('uOpaque');
		expect(FluxLinesShaders.FRAGMENT).not.toContain('uBackground');
	});

	it('leaves no unresolved template marker in the fragment shader', () => {
		expect(FluxLinesShaders.FRAGMENT).not.toContain('${');
	});
});
