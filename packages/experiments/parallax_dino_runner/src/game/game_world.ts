import { CollisionRules } from './collision_rules.ts';
import { CommitRules } from './commit_rules.ts';
import type { CommitRecord } from './commit_types.ts';
import { DinosaurRules } from './dinosaur_rules.ts';
import { GameStateFactory } from './game_state_factory.ts';
import type { GameCommand, GameEvent, GameState } from './game_types.ts';
import { RunRules } from './run_rules.ts';
import { SeededRandom } from './seeded_random.ts';
import { ShootingRules } from './shooting_rules.ts';
import { ThingGenerator } from './thing_generator.ts';
import { ThingRules } from './thing_rules.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GameWorld — the world of the game: it takes the commands and runs the steps
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The world of the game. The page gives it the commands of the player and calls its step again and again. It owns the
 * state of the game, and it is the only class that changes the state. It has no drawing, no keyboard, and no clock.
 */
export class GameWorld {
	/** The state of the game. The page reads it, and only this class changes it. */
	state: GameState;

	/** The seed of the first run. The seed of each next run is this seed plus the number of the run. */
	private _seed: number;

	/** The number of the runs that began after the first run. */
	private _runIndex = 0;

	/** The random number generator of the run. */
	private _random: SeededRandom;

	/** The commits that the run places, from the oldest commit to the newest commit. */
	private _commits: CommitRecord[];

	/** The generator that places the commits and the crates of the run. */
	private _generator: ThingGenerator;

	/**
	 * @param seed The seed of the random numbers. The same seed gives the same worlds.
	 * @param commits The commits that the run places, from the oldest commit to the newest commit.
	 * @throws An error when the list of commits is empty.
	 */
	constructor(seed: number, commits: CommitRecord[]) {
		if (commits.length === 0) {
			throw new Error('The game needs one commit at least.');
		}
		this._seed = seed;
		this._commits = commits;
		this.state = GameStateFactory.create(0);
		this._random = new SeededRandom(seed);
		this._generator = new ThingGenerator(this._random, this._commits);
		this._generator.prefill(this.state);
	}

	/**
	 * Takes a command of the player. The commands "jump", "laneUp", "laneDown", and "shoot" work only while the world
	 * runs. The command "pause" stops the world while it runs, and it lets the world run again while it is paused.
	 * The command "start" begins the first run, it begins a new run after a run is over, and it lets a paused world
	 * run again.
	 * @param command The command.
	 */
	command(command: GameCommand): void {
		if (command === 'start') {
			this._start();
			return;
		}
		if (command === 'pause') {
			this._togglePause();
			return;
		}
		if (this.state.phase !== 'running') {
			return;
		}
		if (command === 'jump') {
			if (DinosaurRules.jump(this.state.dinosaur) === true) {
				this.state.events.push('jump');
			}
		} else if (command === 'laneUp') {
			this._changeLane(-1);
		} else if (command === 'laneDown') {
			this._changeLane(1);
		} else if (command === 'shoot') {
			ShootingRules.shoot(this.state);
		}
	}

	/**
	 * Gives the events that happened since the last call, then forgets them. The page plays a sound for each event.
	 * @returns The events, from the oldest to the newest.
	 */
	takeEvents(): GameEvent[] {
		const events = this.state.events;
		this.state.events = [];
		return events;
	}

	/**
	 * Runs one step of the rules. Nothing moves unless the world runs.
	 * @param seconds The duration of the step, in seconds.
	 */
	step(seconds: number): void {
		if (this.state.phase !== 'running') {
			return;
		}
		this.state.speed = RunRules.speedAt(this.state.distance);
		const distanceMoved = this.state.speed * seconds;
		this.state.distance += distanceMoved;
		DinosaurRules.step(this.state.dinosaur, seconds);
		for (const thing of this.state.things) {
			thing.x -= distanceMoved;
		}
		if (this.state.lastCommitX !== null) {
			this.state.lastCommitX -= distanceMoved;
		}
		ShootingRules.stepBullets(this.state, seconds, distanceMoved, this._random);
		this._generator.step(this.state, distanceMoved);
		ShootingRules.stepPieces(this.state, seconds, distanceMoved);
		ThingRules.removeBehind(this.state);
		if (CollisionRules.resolve(this.state) === true) {
			this._stop('over', 'hit');
		} else if (CommitRules.hasFinished(this.state) === true) {
			this._stop('finished', 'finish');
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Sends the dinosaur to the next lane. The event "laneChange" tells it, unless the dinosaur is at the last lane.
	 * @param direction -1 for the far lane, 1 for the near lane.
	 */
	private _changeLane(direction: -1 | 1): void {
		const lane = this.state.dinosaur.targetLane;
		DinosaurRules.changeLane(this.state.dinosaur, direction);
		if (this.state.dinosaur.targetLane !== lane) {
			this.state.events.push('laneChange');
		}
	}

	/**
	 * Stops the world when it runs, and lets it run again when it is paused. In any other phase, nothing happens.
	 */
	private _togglePause(): void {
		if (this.state.phase === 'running') {
			this.state.phase = 'paused';
		} else if (this.state.phase === 'paused') {
			this.state.phase = 'running';
		}
	}

	/**
	 * Begins the first run, or a new run after a run is over. A paused world runs again, with no new run.
	 */
	private _start(): void {
		if (this.state.phase === 'running') {
			return;
		}
		if (this.state.phase === 'paused') {
			this.state.phase = 'running';
			return;
		}
		if (this.state.phase === 'over' || this.state.phase === 'finished') {
			this._runIndex += 1;
			const pendingEvents = this.state.events;
			this.state = GameStateFactory.create(this.state.bestScore);
			this.state.events = pendingEvents;
			this._random = new SeededRandom(this._seed + this._runIndex);
			this._generator = new ThingGenerator(this._random, this._commits);
			this._generator.prefill(this.state);
		}
		this.state.phase = 'running';
		this.state.events.push('start');
	}

	/**
	 * Ends the run: the world stops, and the best score keeps the best of the runs.
	 * @param phase The phase after the end: "over" when the dinosaur hit something, "finished" when it passed the
	 * newest commit.
	 * @param event The event that tells the page how the run ended.
	 */
	private _stop(phase: 'over' | 'finished', event: GameEvent): void {
		this.state.phase = phase;
		this.state.events.push(event);
		this.state.bestScore = Math.max(this.state.bestScore, RunRules.score(this.state.distance));
	}
}
