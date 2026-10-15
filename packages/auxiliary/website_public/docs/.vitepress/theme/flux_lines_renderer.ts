import { FluxLinesShaders } from './flux_lines_shaders';
import type {
	FluxLinesFlow,
	FluxLinesMagnet,
	FluxLinesOptions,
	FluxLinesPointer,
	FluxLinesProgram,
	FluxLinesSettings,
	FluxLinesSwirl,
} from './flux_lines_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FluxLinesRenderer — draws the Flux Lines background with WebGL2 and follows the pointer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the Flux Lines background in a canvas with WebGL2.
 *
 * Ported from the Flux Lines background of React Bits (https://www.reactbits.dev/c/backgrounds/flux-lines).
 * Copyright (c) 2026 David Haz, licence MIT + Commons Clause (https://github.com/DavidHDev/react-bits).
 * The change from the original: the logic lives in a class, so a Vue component and a test can both use it.
 */
export class FluxLinesRenderer {
	/** The time, in seconds, that the lines take to fade in. */
	static readonly INTRO_SECONDS = 1.8;

	/** The time, in seconds, during which a click swirl is active. */
	static readonly SWIRL_SECONDS = 6;

	/** The flow vector of each flow direction. */
	static readonly FLOW: Record<FluxLinesFlow, [number, number]> = {
		up: [0, 1],
		down: [0, -1],
		left: [-1, 0],
		right: [1, 0],
	};

	/** The color that a color which the browser cannot read becomes, as red, green, and blue from 0 to 1. */
	static readonly FALLBACK_COLOR: number[] = [1, 1, 1];

	/** The element that holds the canvas. Its size gives the size of the canvas. */
	private _container: HTMLElement;

	/** The canvas that the renderer draws into. */
	private _canvas: HTMLCanvasElement;

	/** The WebGL2 context of the canvas. */
	private _gl: WebGL2RenderingContext;

	/** The linked WebGL program. */
	private _program: FluxLinesProgram;

	/** The buffer of the triangle that covers the canvas. */
	private _buffer: WebGLBuffer | null;

	/** The vertex array that holds the buffer. */
	private _vertexArray: WebGLVertexArrayObject | null;

	/** The settings in use. Replaced by the method `update`. */
	private _settings: FluxLinesSettings;

	/** A one pixel canvas that reads a CSS color as red, green, and blue. Null without a 2D canvas. */
	private _colorProbe: CanvasRenderingContext2D | null;

	/** The red, green, and blue of each CSS color that was already read, by the text of the color. */
	private _colorCache = new Map<string, number[]>();

	/** The colors sent to the shader: three numbers for each color. */
	private _palette = new Float32Array(FluxLinesShaders.MAX_COLORS * 3);

	/** True when the visitor asked the system for less motion. The lines then stand still. */
	private _isReducedMotion: boolean;

	/** The position of the pointer. */
	private _pointer: FluxLinesPointer = {
		x: 0,
		y: 0,
		isInside: false,
	};

	/** The magnet that follows the pointer. */
	private _magnet: FluxLinesMagnet = {
		x: 0,
		y: 0,
		strength: 0,
	};

	/** The swirl of the last click. */
	private _swirl: FluxLinesSwirl = {
		x: 0,
		y: 0,
		age: 10,
	};

	/** The time, in seconds, of the animation of the lines. It stops growing when the lines stand still. */
	private _time = 0;

	/** How much of the lines is visible, from 0 to 1. It grows from 0 during the intro. */
	private _reveal: number;

	/** The identifier of the pending animation frame, or 0 when no frame is pending. */
	private _animationFrame = 0;

	/** The time of the last frame, in milliseconds, or 0 when no frame ran since the animation paused. */
	private _lastFrameTime = 0;

	/** True when the background is on the screen. The renderer draws no frame when it is off the screen. */
	private _isVisible = true;

	/** The last value of the option `dpr` that the canvas size used. */
	private _lastDpr: number | undefined;

	/** Watches the size of the container. */
	private _resizeObserver: ResizeObserver | null = null;

	/** Watches whether the container is on the screen. */
	private _intersectionObserver: IntersectionObserver | null = null;

	/**
	 * Keeps the objects of the renderer together. Use the method `create`, which tests the WebGL2 support first.
	 * @param container - The element that holds the canvas.
	 * @param canvas - The canvas to draw into.
	 * @param gl - The WebGL2 context of the canvas.
	 * @param program - The linked WebGL program.
	 * @param settings - The settings of the background.
	 */
	private constructor(
		container: HTMLElement,
		canvas: HTMLCanvasElement,
		gl: WebGL2RenderingContext,
		program: FluxLinesProgram,
		settings: FluxLinesSettings,
	) {
		this._container = container;
		this._canvas = canvas;
		this._gl = gl;
		this._program = program;
		this._settings = settings;
		this._lastDpr = settings.dpr;

		this._buffer = gl.createBuffer();
		this._vertexArray = gl.createVertexArray();
		gl.bindVertexArray(this._vertexArray);
		gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

		this._colorProbe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
		this._isReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		this._reveal = settings.intro === true && this._isReducedMotion === false ? 0 : 1;
	}

	/**
	 * Creates a renderer for a canvas.
	 * @param container - The element that holds the canvas. Its size gives the size of the canvas.
	 * @param canvas - The canvas to draw into.
	 * @param options - The options of the background.
	 * @returns The renderer, or null when the browser has no WebGL2 or when the shaders do not compile.
	 */
	static create(
		container: HTMLElement,
		canvas: HTMLCanvasElement,
		options: FluxLinesOptions,
	): FluxLinesRenderer | null {
		const gl = canvas.getContext('webgl2', {
			alpha: true,
			premultipliedAlpha: true,
			antialias: false,
			depth: false,
			stencil: false,
		});
		if (gl === null) {
			return null;
		}
		const program = FluxLinesRenderer._linkProgram(gl);
		if (program === null) {
			return null;
		}
		const settings = FluxLinesRenderer.normalizeOptions(options);
		return new FluxLinesRenderer(container, canvas, gl, program, settings);
	}

	/**
	 * Fills the missing options with the default values, and puts every value inside its valid range.
	 * @param options - The options of the background.
	 * @returns The settings that the renderer uses.
	 */
	static normalizeOptions(options: FluxLinesOptions): FluxLinesSettings {
		const colors = options.colors !== undefined && options.colors.length > 0
			? options.colors.slice(0, FluxLinesShaders.MAX_COLORS)
			: ['#ffffff', '#ffffff', '#ffffff'];
		return {
			colors,
			speed: options.speed ?? 0.5,
			scale: Math.max(0.05, options.scale ?? 1.6),
			turbulence: options.turbulence ?? 1,
			fluidity: Math.max(0.001, options.fluidity ?? 0.1),
			rimWidth: Math.max(0.001, options.rimWidth ?? 0.2),
			sharpness: Math.max(0.1, options.sharpness ?? 2.5),
			shimmer: Math.max(0, options.shimmer ?? 1.5),
			glow: Math.max(0, options.glow ?? 2),
			lineWidth: Math.max(0, options.lineWidth ?? 1),
			flow: FluxLinesRenderer.FLOW[options.flowDirection ?? 'down'] ?? FluxLinesRenderer.FLOW.down,
			opacity: FluxLinesRenderer._clamp(options.opacity ?? 1, 0, 1),
			mouseInteraction: options.mouseInteraction ?? true,
			mouseStrength: Math.max(0, options.mouseStrength ?? 1),
			mouseRadius: Math.max(0.01, options.mouseRadius ?? 0.35),
			mouseDampening: Math.max(0, options.mouseDampening ?? 0.15),
			clickSwirl: options.clickSwirl ?? true,
			intro: options.intro ?? true,
			lightMode: options.lightMode ?? false,
			dpr: options.dpr,
		};
	}

	/**
	 * Sizes the canvas, listens to the pointer, and starts the animation.
	 * @returns Nothing.
	 */
	start(): void {
		this._resizeObserver = new ResizeObserver(this._resize);
		this._resizeObserver.observe(this._container);
		this._intersectionObserver = new IntersectionObserver((entries) => {
			this._isVisible = entries.some((entry) => entry.isIntersecting);
			if (this._isVisible === true) {
				this._lastFrameTime = 0;
				this._wake();
			}
		});
		this._intersectionObserver.observe(this._container);
		window.addEventListener('pointermove', this._onPointerMove, { passive: true });
		window.addEventListener('pointerdown', this._onPointerDown, { passive: true });
		window.addEventListener('pointerup', this._onPointerUp, { passive: true });
		window.addEventListener('pointercancel', this._onPointerUp, { passive: true });
		document.documentElement.addEventListener('pointerleave', this._onPointerLeave);
		document.addEventListener('visibilitychange', this._onVisibilityChange);
		this._resize();
	}

	/**
	 * Replaces the options and draws again.
	 * @param options - The new options of the background.
	 * @returns Nothing.
	 */
	update(options: FluxLinesOptions): void {
		this._settings = FluxLinesRenderer.normalizeOptions(options);
		if (this._settings.dpr !== this._lastDpr) {
			this._lastDpr = this._settings.dpr;
			this._resize();
			return;
		}
		if (this._animationFrame === 0) {
			this._render();
		}
		this._wake();
	}

	/**
	 * Stops the animation, removes every listener, and frees the WebGL objects.
	 * @returns Nothing.
	 */
	dispose(): void {
		cancelAnimationFrame(this._animationFrame);
		this._animationFrame = 0;
		this._resizeObserver?.disconnect();
		this._intersectionObserver?.disconnect();
		window.removeEventListener('pointermove', this._onPointerMove);
		window.removeEventListener('pointerdown', this._onPointerDown);
		window.removeEventListener('pointerup', this._onPointerUp);
		window.removeEventListener('pointercancel', this._onPointerUp);
		document.documentElement.removeEventListener('pointerleave', this._onPointerLeave);
		document.removeEventListener('visibilitychange', this._onVisibilityChange);
		this._gl.deleteProgram(this._program.program);
		this._gl.deleteBuffer(this._buffer);
		this._gl.deleteVertexArray(this._vertexArray);
		this._gl.getExtension('WEBGL_lose_context')?.loseContext();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Drawing
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Sends the state to the shader and draws one image.
	 * @returns Nothing.
	 */
	private _render(): void {
		const gl = this._gl;
		const settings = this._settings;
		const uniforms = this._program.uniforms;
		const ratio = this._canvas.width / Math.max(1, this._container.clientWidth);
		settings.colors.forEach((value, index) => {
			this._palette.set(this._parseColor(value), index * 3);
		});
		const intro = Math.min(1, this._reveal);
		const swirlAge = this._swirl.age;
		const swirlTwist = 1.9 * Math.min(1, swirlAge / 0.23) * Math.exp(-Math.max(0, swirlAge - 0.23) * 1.1);
		gl.viewport(0, 0, this._canvas.width, this._canvas.height);
		gl.useProgram(this._program.program);
		gl.bindVertexArray(this._vertexArray);
		gl.uniform2f(uniforms.uResolution, this._canvas.width, this._canvas.height);
		gl.uniform1f(uniforms.uTime, this._time);
		gl.uniform2f(uniforms.uFlow, settings.flow[0], settings.flow[1]);
		gl.uniform1f(uniforms.uSpeed, settings.speed);
		gl.uniform1f(uniforms.uScale, settings.scale);
		gl.uniform1f(uniforms.uTurbulence, settings.turbulence);
		gl.uniform1f(uniforms.uFluidity, settings.fluidity);
		gl.uniform1f(uniforms.uRimWidth, settings.rimWidth);
		gl.uniform1f(uniforms.uSharpness, settings.sharpness);
		gl.uniform1f(uniforms.uShimmer, settings.shimmer);
		gl.uniform1f(uniforms.uGlow, settings.glow);
		gl.uniform1f(uniforms.uLine, settings.lineWidth * ratio * 0.5);
		gl.uniform1f(uniforms.uMaxHalf, 28 * ratio);
		gl.uniform3fv(uniforms.uColors, this._palette);
		gl.uniform1i(uniforms.uColorCount, settings.colors.length);
		gl.uniform4f(
			uniforms.uMagnet,
			this._magnet.x,
			this._magnet.y,
			this._magnet.strength * settings.mouseStrength,
			settings.mouseRadius,
		);
		gl.uniform4f(
			uniforms.uSwirl,
			this._swirl.x,
			this._swirl.y,
			this._canvas.height * 0.22 * (1 + swirlAge * 0.5),
			swirlAge < FluxLinesRenderer.SWIRL_SECONDS ? swirlTwist : 0,
		);
		gl.uniform1f(uniforms.uReveal, intro * intro * (3 - 2 * intro));
		gl.uniform1f(uniforms.uLight, settings.lightMode === true ? 1 : 0);
		gl.uniform1f(uniforms.uOpacity, settings.opacity);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	/**
	 * Asks for the next animation frame, unless one is pending or the background cannot be seen.
	 * @returns Nothing.
	 */
	private _wake(): void {
		if (this._animationFrame === 0 && this._isVisible === true && document.hidden === false) {
			this._animationFrame = requestAnimationFrame(this._frame);
		}
	}

	/**
	 * Advances the animation by the time since the last frame, draws one image, and asks for the next frame when
	 * something still moves.
	 * @param now - The time of the frame, in milliseconds.
	 * @returns Nothing.
	 */
	private _frame = (now: number): void => {
		this._animationFrame = 0;
		if (this._isVisible === false || document.hidden === true) {
			return;
		}
		const settings = this._settings;
		const deltaSeconds = this._lastFrameTime !== 0
			? FluxLinesRenderer._clamp((now - this._lastFrameTime) / 1000, 0.0005, 0.05)
			: 1 / 60;
		this._lastFrameTime = now;
		const motion = this._isReducedMotion === true ? 0 : 1;
		this._time += deltaSeconds * motion;
		this._swirl.age += deltaSeconds;
		if (settings.intro === true && this._isReducedMotion === false && this._reveal < 1) {
			this._reveal = Math.min(1, this._reveal + deltaSeconds / FluxLinesRenderer.INTRO_SECONDS);
		} else if (settings.intro === false || this._isReducedMotion === true) {
			this._reveal = 1;
		}

		const isEngaged = settings.mouseInteraction === true && this._pointer.isInside === true;
		const follow = settings.mouseDampening > 0 ? 1 - Math.exp(-deltaSeconds / settings.mouseDampening) : 1;
		if (isEngaged === true) {
			this._magnet.x += (this._pointer.x - this._magnet.x) * follow;
			this._magnet.y += (this._pointer.y - this._magnet.y) * follow;
		}
		const target = isEngaged === true ? 1 : 0;
		this._magnet.strength += (target - this._magnet.strength) * (1 - Math.exp(-deltaSeconds / 0.3));
		if (Math.abs(target - this._magnet.strength) < 0.001) {
			this._magnet.strength = target;
		}

		this._render();
		const isBusy = motion > 0
			|| this._magnet.strength !== target
			|| this._reveal < 1
			|| this._swirl.age < FluxLinesRenderer.SWIRL_SECONDS;
		if (isBusy === true) {
			this._animationFrame = requestAnimationFrame(this._frame);
		} else {
			this._lastFrameTime = 0;
		}
	};

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Events
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Sets the size of the canvas to the size of the container, then draws.
	 * @returns Nothing.
	 */
	private _resize = (): void => {
		const width = Math.max(1, this._container.clientWidth);
		const height = Math.max(1, this._container.clientHeight);
		const ratio = Math.min(this._settings.dpr || window.devicePixelRatio || 1, 2);
		this._canvas.width = Math.max(1, Math.round(width * ratio));
		this._canvas.height = Math.max(1, Math.round(height * ratio));
		this._render();
		this._wake();
	};

	/**
	 * Reads the position of the pointer, in device pixels from the bottom left corner of the container.
	 * @param event - The pointer event.
	 * @returns Nothing.
	 */
	private _locate(event: PointerEvent): void {
		const rect = this._container.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const ratio = this._canvas.width / Math.max(1, rect.width);
		this._pointer.isInside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
		this._pointer.x = x * ratio;
		this._pointer.y = (rect.height - y) * ratio;
	}

	/**
	 * Moves the pointer. The magnet jumps to the pointer when the pointer comes in.
	 * @param event - The pointer event.
	 * @returns Nothing.
	 */
	private _onPointerMove = (event: PointerEvent): void => {
		const wasInside = this._pointer.isInside;
		this._locate(event);
		if (this._pointer.isInside === true && wasInside === false && this._magnet.strength < 0.05) {
			this._magnet.x = this._pointer.x;
			this._magnet.y = this._pointer.y;
		}
		this._wake();
	};

	/**
	 * Starts a swirl at the position of the click.
	 * @param event - The pointer event.
	 * @returns Nothing.
	 */
	private _onPointerDown = (event: PointerEvent): void => {
		this._onPointerMove(event);
		const isSwirlAllowed = this._settings.clickSwirl === true && this._isReducedMotion === false;
		if (this._pointer.isInside === false || isSwirlAllowed === false) {
			return;
		}
		this._swirl.x = this._pointer.x;
		this._swirl.y = this._pointer.y;
		this._swirl.age = 0;
		this._wake();
	};

	/**
	 * Lets the magnet go when a finger leaves the screen. A mouse pointer stays where it is.
	 * @param event - The pointer event.
	 * @returns Nothing.
	 */
	private _onPointerUp = (event: PointerEvent): void => {
		if (event.pointerType !== 'mouse') {
			this._pointer.isInside = false;
		}
	};

	/**
	 * Lets the magnet go when the pointer leaves the page.
	 * @returns Nothing.
	 */
	private _onPointerLeave = (): void => {
		this._pointer.isInside = false;
	};

	/**
	 * Restarts the animation when the visitor comes back to the tab of the browser.
	 * @returns Nothing.
	 */
	private _onVisibilityChange = (): void => {
		this._lastFrameTime = 0;
		this._wake();
	};

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Reads a CSS color as red, green, and blue.
	 * @param value - A CSS color, for example `#ffbe3c`.
	 * @returns Red, green, and blue, each from 0 to 1.
	 */
	private _parseColor(value: string): number[] {
		const cached = this._colorCache.get(value);
		if (cached !== undefined) {
			return cached;
		}
		let rgb = FluxLinesRenderer.FALLBACK_COLOR;
		if (this._colorProbe !== null) {
			this._colorProbe.clearRect(0, 0, 1, 1);
			this._colorProbe.fillStyle = '#000000';
			this._colorProbe.fillStyle = value;
			this._colorProbe.fillRect(0, 0, 1, 1);
			const [red, green, blue] = this._colorProbe.getImageData(0, 0, 1, 1).data;
			rgb = [red / 255, green / 255, blue / 255];
		}
		this._colorCache.set(value, rgb);
		return rgb;
	}

	/**
	 * Keeps a number between a minimum and a maximum.
	 * @param value - The number.
	 * @param min - The smallest allowed value.
	 * @param max - The largest allowed value.
	 * @returns The number, or the nearest limit.
	 */
	private static _clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	/**
	 * Compiles one shader.
	 * @param gl - The WebGL2 context.
	 * @param type - `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`.
	 * @param source - The GLSL source code.
	 * @returns The shader, or null when the compilation fails.
	 */
	private static _compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
		const shader = gl.createShader(type);
		if (shader === null) {
			return null;
		}
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true) {
			return shader;
		}
		gl.deleteShader(shader);
		return null;
	}

	/**
	 * Compiles and links the program of the background.
	 * @param gl - The WebGL2 context.
	 * @returns The program with the location of each uniform value, or null when the compilation or the link fails.
	 */
	private static _linkProgram(gl: WebGL2RenderingContext): FluxLinesProgram | null {
		const { VERTEX, FRAGMENT } = FluxLinesShaders;
		const vertexShader = FluxLinesRenderer._compileShader(gl, gl.VERTEX_SHADER, VERTEX);
		const fragmentShader = FluxLinesRenderer._compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
		const program = gl.createProgram();
		if (vertexShader === null || fragmentShader === null || program === null) {
			return null;
		}
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.bindAttribLocation(program, 0, 'aPosition');
		gl.linkProgram(program);
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
			gl.deleteProgram(program);
			return null;
		}
		const uniforms: Record<string, WebGLUniformLocation | null> = {};
		const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
		for (let index = 0; index < uniformCount; index++) {
			const info = gl.getActiveUniform(program, index);
			if (info !== null) {
				uniforms[info.name.replace('[0]', '')] = gl.getUniformLocation(program, info.name);
			}
		}
		return { program, uniforms };
	}
}
