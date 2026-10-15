import { GameSettings, GameStateFactory, GameWorld, SeededRandom, ShootingRules } from '../src/index.ts';
import { ThingGenerator, ThingRules } from '../src/index.ts';
import type { GameState, RockSize, Thing } from '../src/index.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TestStates — small game states and small runs for the tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A world that the generator filled for a long distance.
 */
export type GeneratedWorld = {
	/** The state, with every row that the generator made. */
	gameState: GameState;
	/** The distance that the world went through, in units. */
	traveled: number;
};

/**
 * Makes small game states and runs small parts of the rules for the tests. Only the tests import this class.
 */
export class TestStates {
	/**
	 * Makes a state in the phase "running" with no thing.
	 * @returns The state.
	 */
	static createRunning(): GameState {
		const gameState = GameStateFactory.create(0);
		gameState.phase = 'running';
		return gameState;
	}

	/**
	 * Makes a state in the phase "running" with one rock.
	 * @param lane The lane of the rock.
	 * @param x The distance of the rock in front of the dinosaur, in units.
	 * @param rockSize The size of the rock.
	 * @returns The state.
	 */
	static createWithRock(lane: number, x: number, rockSize: RockSize): GameState {
		const gameState = TestStates.createRunning();
		gameState.things.push(ThingRules.createRock(gameState, lane, x, rockSize));
		return gameState;
	}

	/**
	 * Runs a number of steps of the rules of a world.
	 * @param gameWorld The world.
	 * @param stepCount The number of steps.
	 */
	static runSteps(gameWorld: GameWorld, stepCount: number): void {
		for (let index = 0; index < stepCount; index += 1) {
			gameWorld.step(GameSettings.STEP_SECONDS);
		}
	}

	/**
	 * Runs a number of steps of the bullets, in a world that does not move.
	 * @param gameState The state of the game.
	 * @param random The random number generator.
	 * @param stepCount The number of steps.
	 */
	static stepBullets(gameState: GameState, random: SeededRandom, stepCount: number): void {
		for (let index = 0; index < stepCount; index += 1) {
			ShootingRules.stepBullets(gameState, GameSettings.STEP_SECONDS, 0, random);
		}
	}

	/**
	 * Counts the moments at which the dinosaur can start a jump and pass one thing alive. The test starts a new run
	 * for each moment, puts one thing in the lane of the dinosaur, jumps at that moment, and runs the rules until the
	 * thing is behind the dinosaur. A count of zero means that no jump clears the thing.
	 * @param createThing Makes the thing, at the distance that it gets.
	 * @param distance The distance that the run already went through, in units. It sets the speed of the world.
	 * @returns The number of moments, one moment for each step of the rules.
	 */
	static countJumpsThatClear(createThing: (gameState: GameState, x: number) => Thing, distance: number): number {
		const momentCount = 80;
		const stepCount = 90;
		let clearCount = 0;
		for (let jumpStep = 0; jumpStep < momentCount; jumpStep += 1) {
			const gameWorld = new GameWorld(1);
			gameWorld.command('start');
			gameWorld.state.things = [];
			gameWorld.state.distance = distance;
			gameWorld.state.things.push(createThing(gameWorld.state, 400));
			for (let step = 0; step < stepCount && gameWorld.state.phase === 'running'; step += 1) {
				if (step === jumpStep) {
					gameWorld.command('jump');
				}
				gameWorld.step(GameSettings.STEP_SECONDS);
			}
			if (gameWorld.state.phase === 'running') {
				clearCount += 1;
			}
		}
		return clearCount;
	}

	/**
	 * Makes a world and runs the generator for a long distance. The things move toward the dinosaur as in a run, and
	 * nothing takes them out.
	 * @param seed The seed of the random numbers.
	 * @returns The state and the distance that the world went through.
	 */
	static generateWorld(seed: number): GeneratedWorld {
		const gameState = GameStateFactory.create(0);
		const generator = new ThingGenerator(new SeededRandom(seed));
		generator.prefill(gameState);
		gameState.speed = 600;
		const distanceMoved = 150;
		let traveled = 0;
		for (let index = 0; index < 400; index += 1) {
			for (const thing of gameState.things) {
				thing.x -= distanceMoved;
			}
			traveled += distanceMoved;
			generator.step(gameState, distanceMoved);
		}
		const generatedWorld: GeneratedWorld = {
			gameState,
			traveled,
		};
		return generatedWorld;
	}

	/**
	 * Groups the things of a generated world by their row. The distance of a row is measured from the start of the
	 * run, so a row keeps its distance while the world moves.
	 * @param generatedWorld The generated world.
	 * @returns The rows, sorted from the first row to the last row.
	 */
	static groupRows(generatedWorld: GeneratedWorld): Thing[][] {
		const rows = new Map<number, Thing[]>();
		for (const thing of generatedWorld.gameState.things) {
			const rowDistance = thing.x + generatedWorld.traveled;
			const row = rows.get(rowDistance) ?? [];
			row.push(thing);
			rows.set(rowDistance, row);
		}
		const sortedDistances = [...rows.keys()].sort((first, second) => first - second);
		const sortedRows = sortedDistances.map((rowDistance) => rows.get(rowDistance) ?? []);
		return sortedRows;
	}

	/**
	 * Describes the things of a state, one text for each thing, to compare two worlds.
	 * @param gameState The state.
	 * @returns The texts.
	 */
	static describeThings(gameState: GameState): string[] {
		const descriptions = gameState.things.map((thing) => {
			return `${thing.kind}:${thing.rockSize}:${thing.lane}:${thing.x.toFixed(3)}`;
		});
		return descriptions;
	}
}
