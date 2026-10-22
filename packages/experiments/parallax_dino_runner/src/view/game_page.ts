import { GameSettings, GameWorld } from '../index.ts';
import { CommitLoader } from './commit_loader.ts';
import type { LoadedCommits } from './commit_loader.ts';
import { KeyboardInput } from './keyboard_input.ts';
import { SceneRenderer } from './scene_renderer.ts';
import { SoundPlayer } from './sound_player.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GamePage — the entry of index.html: the canvas, the keyboard, and the game loop
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The page of the game. It owns the canvas, it gives the keys to the world, it runs the rules in fixed steps of one
 * sixtieth of a second, it plays the sound of each event, and it draws one picture after each frame of the browser.
 * It reads the commits to play with from the file `commits.json` next to the page. Add "?seed=42" to the address of
 * the page to play the same world again.
 */
export class GamePage {
	/** The longest time that one frame can give to the rules, in seconds. A tab that was hidden does not jump ahead. */
	private static readonly _LONGEST_FRAME_SECONDS = 0.25;

	/** The canvas of the page. */
	private _canvas: HTMLCanvasElement;

	/** The drawing context of the canvas. */
	private _context: CanvasRenderingContext2D;

	/** The world of the game. */
	private _gameWorld: GameWorld;

	/** A text for the player when the commits are fake, or null. */
	private _notice: string | null;

	/** The sounds of the game. */
	private _soundPlayer = new SoundPlayer();

	/** The time of the rules that the steps did not use yet, in seconds. */
	private _pendingSeconds = 0;

	/** The time of the last frame, in milliseconds, or null before the first frame. */
	private _lastFrameTime: number | null = null;

	/**
	 * @param canvas The canvas of the page.
	 * @param context The drawing context of the canvas.
	 * @param seed The seed of the random numbers of the world.
	 * @param loadedCommits The commits to play with.
	 */
	private constructor(
		canvas: HTMLCanvasElement,
		context: CanvasRenderingContext2D,
		seed: number,
		loadedCommits: LoadedCommits,
	) {
		this._canvas = canvas;
		this._context = context;
		this._gameWorld = new GameWorld(seed, loadedCommits.commits);
		this._notice = loadedCommits.notice;
	}

	/**
	 * Reads the commits, then starts the game on the page that is open.
	 */
	static async start(): Promise<void> {
		const canvas = document.getElementById('game');
		if (canvas instanceof HTMLCanvasElement === false) {
			throw new Error('The page has no canvas with the identifier "game".');
		}
		const context = canvas.getContext('2d');
		if (context === null) {
			throw new Error('The browser gives no drawing context for the canvas.');
		}
		const loadedCommits = await CommitLoader.load();
		const gamePage = new GamePage(canvas, context, GamePage._readSeed(), loadedCommits);
		gamePage._run();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Reads the seed from the address of the page, or makes a random seed.
	 * @returns The seed.
	 */
	private static _readSeed(): number {
		const seedText = new URLSearchParams(window.location.search).get('seed');
		const seed = seedText === null ? Number.NaN : Number.parseInt(seedText, 10);
		if (Number.isNaN(seed) === false) {
			return seed;
		}
		return Math.floor(Math.random() * 2 ** 31);
	}

	/**
	 * Connects the keyboard and the window, then asks for the first frame.
	 */
	private _run(): void {
		KeyboardInput.attach(window, (action) => {
			this._soundPlayer.resume();
			if (action === 'toggleSound') {
				this._soundPlayer.toggleMuted();
				return;
			}
			this._gameWorld.command(action);
		});
		window.addEventListener('resize', () => {
			this._resize();
		});
		this._resize();
		window.requestAnimationFrame((time) => {
			this._frame(time);
		});
	}

	/**
	 * Gives the canvas one pixel of the screen for each pixel of the screen, so the picture stays sharp.
	 */
	private _resize(): void {
		const pixelRatio = window.devicePixelRatio || 1;
		this._canvas.width = Math.max(1, Math.round(this._canvas.clientWidth * pixelRatio));
		this._canvas.height = Math.max(1, Math.round(this._canvas.clientHeight * pixelRatio));
	}

	/**
	 * Runs the rules for the time that passed, draws one picture, then asks for the next frame.
	 * @param time The time of the frame, in milliseconds.
	 */
	private _frame(time: number): void {
		const passedSeconds = this._lastFrameTime === null ? 0 : (time - this._lastFrameTime) / 1000;
		this._lastFrameTime = time;
		this._pendingSeconds += Math.min(passedSeconds, GamePage._LONGEST_FRAME_SECONDS);
		while (this._pendingSeconds >= GameSettings.STEP_SECONDS) {
			this._gameWorld.step(GameSettings.STEP_SECONDS);
			this._pendingSeconds -= GameSettings.STEP_SECONDS;
		}
		for (const event of this._gameWorld.takeEvents()) {
			this._soundPlayer.play(event);
		}
		SceneRenderer.render(
			this._context,
			this._gameWorld.state,
			this._canvas.width,
			this._canvas.height,
			this._notice,
		);
		window.requestAnimationFrame((nextTime) => {
			this._frame(nextTime);
		});
	}
}

void GamePage.start();
