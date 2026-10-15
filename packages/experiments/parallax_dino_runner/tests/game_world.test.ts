import { describe, expect, it } from 'vitest';
import { GameSettings, GameWorld, RunRules, ThingRules } from '../src/index.ts';
import { TestStates } from './test_states.ts';

describe('GameWorld', () => {
	it('waits in the phase "ready" until the command "start"', () => {
		const gameWorld = new GameWorld(1);
		expect(gameWorld.state.phase).toBe('ready');
		gameWorld.command('jump');
		TestStates.runSteps(gameWorld, 30);
		expect(gameWorld.state.distance).toBe(0);
		expect(gameWorld.state.dinosaur.height).toBe(0);
		gameWorld.command('start');
		expect(gameWorld.state.phase).toBe('running');
	});

	it('moves the world toward the dinosaur while the world runs', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		const firstThingX = gameWorld.state.things[0].x;
		TestStates.runSteps(gameWorld, 10);
		expect(gameWorld.state.distance).toBeGreaterThan(0);
		expect(gameWorld.state.things[0].x).toBeLessThan(firstThingX);
	});

	it('goes faster with the distance', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.state.dinosaur.height = 500;
		TestStates.runSteps(gameWorld, 5);
		const earlySpeed = gameWorld.state.speed;
		gameWorld.state.distance = 10_000;
		TestStates.runSteps(gameWorld, 1);
		expect(gameWorld.state.speed).toBeGreaterThan(earlySpeed);
		expect(gameWorld.state.speed).toBe(RunRules.speedAt(10_000));
	});

	it('takes the commands of the player while the world runs', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.command('laneUp');
		expect(gameWorld.state.dinosaur.targetLane).toBe(0);
		gameWorld.command('laneDown');
		gameWorld.command('laneDown');
		expect(gameWorld.state.dinosaur.targetLane).toBe(2);
		gameWorld.command('jump');
		expect(gameWorld.state.dinosaur.verticalSpeed).toBe(GameSettings.JUMP_SPEED);
		gameWorld.command('shoot');
		expect(gameWorld.state.bullets).toHaveLength(1);
		expect(gameWorld.state.ammunition).toBe(GameSettings.START_AMMUNITION - 1);
	});

	it('ends the run when a rock hits the dinosaur, and keeps the best score', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.state.things = [];
		gameWorld.state.things.push(ThingRules.createRock(gameWorld.state, 1, 40, 'large'));
		gameWorld.state.distance = 5000;
		TestStates.runSteps(gameWorld, 30);
		expect(gameWorld.state.phase).toBe('over');
		expect(gameWorld.state.bestScore).toBeGreaterThan(0);
		const distanceAtTheEnd = gameWorld.state.distance;
		TestStates.runSteps(gameWorld, 30);
		expect(gameWorld.state.distance).toBe(distanceAtTheEnd);
	});

	it('begins a new run with the command "start" after a run is over', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.state.things = [];
		gameWorld.state.things.push(ThingRules.createRock(gameWorld.state, 1, 40, 'large'));
		gameWorld.state.distance = 5000;
		TestStates.runSteps(gameWorld, 30);
		const bestScore = gameWorld.state.bestScore;
		gameWorld.command('start');
		expect(gameWorld.state.phase).toBe('running');
		expect(gameWorld.state.distance).toBe(0);
		expect(gameWorld.state.ammunition).toBe(GameSettings.START_AMMUNITION);
		expect(gameWorld.state.bestScore).toBe(bestScore);
		expect(gameWorld.state.things.length).toBeGreaterThan(0);
	});

	it('lets the dinosaur pass a cactus by a jump', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.state.things = [];
		gameWorld.state.things.push(ThingRules.createCactus(gameWorld.state, 1, 150));
		let isJumping = false;
		for (let index = 0; index < 120; index += 1) {
			if (isJumping === false && gameWorld.state.things.length > 0 && gameWorld.state.things[0].x < 140) {
				gameWorld.command('jump');
				isJumping = true;
			}
			gameWorld.step(GameSettings.STEP_SECONDS);
		}
		expect(gameWorld.state.phase).toBe('running');
	});

	it('breaks a large rock with shots, then the dinosaur passes it', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.state.things = [];
		gameWorld.state.things.push(ThingRules.createRock(gameWorld.state, 1, 800, 'large'));
		for (let index = 0; index < 3; index += 1) {
			gameWorld.command('shoot');
			TestStates.runSteps(gameWorld, 6);
		}
		TestStates.runSteps(gameWorld, 40);
		expect(gameWorld.state.things.filter((thing) => thing.kind === 'rock')).toHaveLength(0);
		TestStates.runSteps(gameWorld, 60);
		expect(gameWorld.state.phase).toBe('running');
	});
});
