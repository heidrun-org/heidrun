// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FluxLinesRenderer } from '../docs/.vitepress/theme/flux_lines_renderer';
import { FluxLinesShaders } from '../docs/.vitepress/theme/flux_lines_shaders';

/** The functions of a fake WebGL2 context that the tests watch. */
type FakeGl = Record<string, unknown> & {
	/** The number of calls of `drawArrays`. */
	drawArrays: ReturnType<typeof vi.fn>;
	/** The calls of `deleteProgram`. */
	deleteProgram: ReturnType<typeof vi.fn>;
	/** The calls of `uniform1f`. */
	uniform1f: ReturnType<typeof vi.fn>;
	/** The calls of `getExtension`. */
	getExtension: ReturnType<typeof vi.fn>;
};

const LOSE_CONTEXT = {
	loseContext: vi.fn(),
};

const UNIFORM_NAMES = [...FluxLinesShaders.FRAGMENT.matchAll(/^uniform \w+ (\w+(?:\[\d+\])?);$/gm)]
	.map((match) => match[1]);

const makeFakeGl = (options: { isCompileOk: boolean }): FakeGl => ({
	VERTEX_SHADER: 1,
	FRAGMENT_SHADER: 2,
	COMPILE_STATUS: 3,
	LINK_STATUS: 4,
	ACTIVE_UNIFORMS: 5,
	ARRAY_BUFFER: 6,
	STATIC_DRAW: 7,
	FLOAT: 8,
	TRIANGLES: 9,
	createShader: vi.fn(() => ({})),
	shaderSource: vi.fn(),
	compileShader: vi.fn(),
	getShaderParameter: vi.fn(() => options.isCompileOk),
	deleteShader: vi.fn(),
	createProgram: vi.fn(() => ({})),
	attachShader: vi.fn(),
	bindAttribLocation: vi.fn(),
	linkProgram: vi.fn(),
	getProgramParameter: vi.fn((_program: unknown, name: number) => (name === 5 ? UNIFORM_NAMES.length : true)),
	getActiveUniform: vi.fn((_program: unknown, index: number) => ({ name: UNIFORM_NAMES[index] })),
	getUniformLocation: vi.fn((_program: unknown, name: string) => ({ name })),
	deleteProgram: vi.fn(),
	createBuffer: vi.fn(() => ({})),
	createVertexArray: vi.fn(() => ({})),
	bindVertexArray: vi.fn(),
	bindBuffer: vi.fn(),
	bufferData: vi.fn(),
	enableVertexAttribArray: vi.fn(),
	vertexAttribPointer: vi.fn(),
	deleteBuffer: vi.fn(),
	deleteVertexArray: vi.fn(),
	getExtension: vi.fn(() => LOSE_CONTEXT),
	viewport: vi.fn(),
	useProgram: vi.fn(),
	uniform1f: vi.fn(),
	uniform1i: vi.fn(),
	uniform2f: vi.fn(),
	uniform3fv: vi.fn(),
	uniform4f: vi.fn(),
	drawArrays: vi.fn(),
});

const createRenderer = (): FluxLinesRenderer | null => FluxLinesRenderer.create(
	document.createElement('div'),
	document.createElement('canvas'),
	{},
);

describe('FluxLinesRenderer.normalizeOptions', () => {
	it('gives every missing option its default value', () => {
		const settings = FluxLinesRenderer.normalizeOptions({});
		expect(settings.colors).toEqual(['#ffffff', '#ffffff', '#ffffff']);
		expect(settings.speed).toBe(0.5);
		expect(settings.scale).toBe(1.6);
		expect(settings.opacity).toBe(1);
		expect(settings.mouseInteraction).toBe(true);
		expect(settings.clickSwirl).toBe(true);
		expect(settings.intro).toBe(true);
		expect(settings.lightMode).toBe(false);
		expect(settings.flow).toEqual([0, -1]);
		expect(settings.dpr).toBeUndefined();
	});

	it('keeps the value of an option that the caller sets', () => {
		const settings = FluxLinesRenderer.normalizeOptions({
			speed: 2,
			lightMode: true,
			flowDirection: 'right',
		});
		expect(settings.speed).toBe(2);
		expect(settings.lightMode).toBe(true);
		expect(settings.flow).toEqual([1, 0]);
	});

	it('keeps the opacity between 0 and 1', () => {
		expect(FluxLinesRenderer.normalizeOptions({ opacity: 4 }).opacity).toBe(1);
		expect(FluxLinesRenderer.normalizeOptions({ opacity: -1 }).opacity).toBe(0);
	});

	it('raises a value that is below its smallest allowed value', () => {
		const settings = FluxLinesRenderer.normalizeOptions({
			scale: 0,
			fluidity: 0,
			rimWidth: 0,
			sharpness: 0,
			mouseRadius: 0,
			glow: -1,
		});
		expect(settings.scale).toBe(0.05);
		expect(settings.fluidity).toBe(0.001);
		expect(settings.rimWidth).toBe(0.001);
		expect(settings.sharpness).toBe(0.1);
		expect(settings.mouseRadius).toBe(0.01);
		expect(settings.glow).toBe(0);
	});

	it('keeps at most 8 colors', () => {
		const colors = Array.from({ length: 12 }, (_, index) => `#00000${index % 10}`);
		expect(FluxLinesRenderer.normalizeOptions({ colors }).colors).toHaveLength(8);
	});

	it('replaces an empty list of colors by white', () => {
		expect(FluxLinesRenderer.normalizeOptions({ colors: [] }).colors.length).toBeGreaterThan(0);
	});
});

describe('FluxLinesRenderer.create', () => {
	let isCompileOk = true;
	let fakeGl: FakeGl;
	let animationFrameCallbacks: FrameRequestCallback[];

	beforeEach(() => {
		isCompileOk = true;
		animationFrameCallbacks = [];
		vi.stubGlobal('ResizeObserver', class {
			observe = vi.fn();
			disconnect = vi.fn();
		});
		vi.stubGlobal('IntersectionObserver', class {
			observe = vi.fn();
			disconnect = vi.fn();
		});
		vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
			animationFrameCallbacks.push(callback);
			return animationFrameCallbacks.length;
		}));
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
			if (kind === 'webgl2') {
				fakeGl = makeFakeGl({ isCompileOk });
				return fakeGl;
			}
			return null;
		}) as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('returns null when the browser has no WebGL2', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		expect(createRenderer()).toBeNull();
	});

	it('returns null when a shader does not compile', () => {
		isCompileOk = false;
		expect(createRenderer()).toBeNull();
	});

	it('draws one image when it starts', () => {
		const renderer = createRenderer();
		expect(renderer).not.toBeNull();
		renderer?.start();
		expect(fakeGl.drawArrays).toHaveBeenCalledTimes(1);
		renderer?.dispose();
	});

	it('advances the time of the lines at each animation frame', () => {
		const renderer = createRenderer();
		renderer?.start();
		const callback = animationFrameCallbacks.at(-1);
		expect(callback).toBeDefined();
		callback?.(1000);
		callback?.(1016);
		expect(fakeGl.drawArrays).toHaveBeenCalledTimes(3);
		renderer?.dispose();
	});

	it('listens to the pointer on the window, and removes every listener when it is disposed', () => {
		const addSpy = vi.spyOn(window, 'addEventListener');
		const removeSpy = vi.spyOn(window, 'removeEventListener');
		const renderer = createRenderer();
		renderer?.start();
		const added = addSpy.mock.calls
			.map((call) => call[0])
			.filter((name) => name.startsWith('pointer'));
		expect(added.sort()).toEqual(['pointercancel', 'pointerdown', 'pointermove', 'pointerup']);
		renderer?.dispose();
		const removed = removeSpy.mock.calls
			.map((call) => call[0])
			.filter((name) => name.startsWith('pointer'));
		expect(removed.sort()).toEqual(['pointercancel', 'pointerdown', 'pointermove', 'pointerup']);
	});

	it('frees the WebGL program and gives the context back when it is disposed', () => {
		const renderer = createRenderer();
		renderer?.start();
		renderer?.dispose();
		expect(fakeGl.deleteProgram).toHaveBeenCalledTimes(1);
		expect(LOSE_CONTEXT.loseContext).toHaveBeenCalled();
	});

	it('draws the next animation frame with the new options when they change', () => {
		const renderer = createRenderer();
		renderer?.start();
		renderer?.update({ opacity: 0.25 });
		animationFrameCallbacks.at(-1)?.(1000);
		expect(fakeGl.uniform1f).toHaveBeenLastCalledWith({ name: 'uOpacity' }, 0.25);
		renderer?.dispose();
	});
});
