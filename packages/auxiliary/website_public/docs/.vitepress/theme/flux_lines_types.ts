///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Flux Lines types — the options, the settings, and the state of the Flux Lines background
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The direction in which the lines of the background flow. */
export type FluxLinesFlow = 'up' | 'down' | 'left' | 'right';

/** The options of the background Flux Lines. A missing option takes its default value. */
export type FluxLinesOptions = {
	/** The colors of the lines, as CSS colors. The renderer reads at most 8 colors. Default: three white colors. */
	colors?: string[];
	/** The speed of the flow. Default: 0.5. */
	speed?: number;
	/** The scale of the pattern. A larger value gives larger shapes. Default: 1.6. */
	scale?: number;
	/** The strength of the distortion of the fluid. Default: 1. */
	turbulence?: number;
	/** The softness of the merge between the two layers of the fluid. Default: 0.1. */
	fluidity?: number;
	/** The width of the lit band around each line. Default: 0.2. */
	rimWidth?: number;
	/** The sharpness of the glow. A larger value gives thinner glows. Default: 2.5. */
	sharpness?: number;
	/** The strength of the shimmer along the lines. Default: 1.5. */
	shimmer?: number;
	/** The brightness of the glow. Default: 2. */
	glow?: number;
	/** The width of the bright core of each line, in CSS pixels. Default: 1. */
	lineWidth?: number;
	/** The direction in which the lines flow. Default: `down`. */
	flowDirection?: FluxLinesFlow;
	/** The opacity of the whole background, from 0 to 1. Default: 1. */
	opacity?: number;
	/** True when the pointer works as a magnet that reveals and curls the lines. Default: true. */
	mouseInteraction?: boolean;
	/** The strength of the magnet. Default: 1. */
	mouseStrength?: number;
	/** The radius of the magnet, as a fraction of the height of the background. Default: 0.35. */
	mouseRadius?: number;
	/** The delay, in seconds, that the magnet takes to follow the pointer. Default: 0.15. */
	mouseDampening?: number;
	/** True when a click makes the lines swirl around the pointer. Default: true. */
	clickSwirl?: boolean;
	/** True when the lines fade in when the background appears. Default: true. */
	intro?: boolean;
	/** True when the lines are dark on a light page, instead of bright on a dark page. Default: false. */
	lightMode?: boolean;
	/** The maximum number of device pixels for each CSS pixel. Default: the ratio of the screen, at most 2. */
	dpr?: number;
};

/** The options after the normalization: every field is present and inside its valid range. */
export type FluxLinesSettings = {
	/** The colors of the lines, as CSS colors. At least one color, at most 8 colors. */
	colors: string[];
	/** The speed of the flow. */
	speed: number;
	/** The scale of the pattern. At least 0.05. */
	scale: number;
	/** The strength of the distortion of the fluid. */
	turbulence: number;
	/** The softness of the merge between the two layers of the fluid. At least 0.001. */
	fluidity: number;
	/** The width of the lit band around each line. At least 0.001. */
	rimWidth: number;
	/** The sharpness of the glow. At least 0.1. */
	sharpness: number;
	/** The strength of the shimmer along the lines. At least 0. */
	shimmer: number;
	/** The brightness of the glow. At least 0. */
	glow: number;
	/** The width of the bright core of each line, in CSS pixels. At least 0. */
	lineWidth: number;
	/** The direction in which the lines flow, as a vector of two numbers. */
	flow: [number, number];
	/** The opacity of the whole background, from 0 to 1. */
	opacity: number;
	/** True when the pointer works as a magnet. */
	mouseInteraction: boolean;
	/** The strength of the magnet. At least 0. */
	mouseStrength: number;
	/** The radius of the magnet, as a fraction of the height of the background. At least 0.01. */
	mouseRadius: number;
	/** The delay, in seconds, that the magnet takes to follow the pointer. At least 0. */
	mouseDampening: number;
	/** True when a click makes the lines swirl. */
	clickSwirl: boolean;
	/** True when the lines fade in when the background appears. */
	intro: boolean;
	/** True when the lines are dark on a light page. */
	lightMode: boolean;
	/** The maximum number of device pixels for each CSS pixel, or undefined to use the ratio of the screen. */
	dpr: number | undefined;
};

/** The WebGL program of the background, with the location of each uniform value. */
export type FluxLinesProgram = {
	/** The linked WebGL program. */
	program: WebGLProgram;
	/** The location of each uniform value of the program, by name. */
	uniforms: Record<string, WebGLUniformLocation | null>;
};

/** The position of the pointer, in device pixels, with the origin at the bottom left corner of the background. */
export type FluxLinesPointer = {
	/** The horizontal position of the pointer. */
	x: number;
	/** The vertical position of the pointer. */
	y: number;
	/** True when the pointer is inside the background. */
	isInside: boolean;
};

/** The magnet that follows the pointer. */
export type FluxLinesMagnet = {
	/** The horizontal position of the magnet, in device pixels. */
	x: number;
	/** The vertical position of the magnet, in device pixels. */
	y: number;
	/** The strength of the magnet now, from 0 to 1. It grows when the pointer comes in and falls when it leaves. */
	strength: number;
};

/** The swirl that a click makes. */
export type FluxLinesSwirl = {
	/** The horizontal position of the center of the swirl, in device pixels. */
	x: number;
	/** The vertical position of the center of the swirl, in device pixels. */
	y: number;
	/** The time, in seconds, since the click. A value of 10 means that no swirl is active. */
	age: number;
};
