import { describe, expect, it } from 'vitest';
import { GameSettings, GameWorld, SeededRandom, ShootingRules, ThingRules } from '../src/index.ts';
import { TestStates } from './test_states.ts';

describe('Game events', () => {
	it('gives the event "start" when a run starts, and takes the events only one time', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		expect(gameWorld.takeEvents()).toEqual(['start']);
		expect(gameWorld.takeEvents()).toEqual([]);
	});

	it('gives the event "jump" for a jump, and no event for a jump in the air', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.takeEvents();
		gameWorld.command('jump');
		TestStates.runSteps(gameWorld, 3);
		gameWorld.command('jump');
		expect(gameWorld.takeEvents()).toEqual(['jump']);
	});

	it('gives the event "laneChange" for each lane change, and no event at the last lane', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.takeEvents();
		gameWorld.command('laneUp');
		gameWorld.command('laneUp');
		gameWorld.command('laneDown');
		expect(gameWorld.takeEvents()).toEqual(['laneChange', 'laneChange']);
	});

	it('gives the event "shoot" for a shot, and the event "shootEmpty" with no ammunition', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.takeEvents();
		gameWorld.state.ammunition = 1;
		gameWorld.command('shoot');
		gameWorld.command('shoot');
		expect(gameWorld.takeEvents()).toEqual(['shoot', 'shootEmpty']);
	});

	it('gives the event "rockShrunk" for a shot that does not destroy the rock, then "rockDestroyed"', () => {
		const random = new SeededRandom(1);
		const gameState = TestStates.createWithRock(1, 400, 'medium');
		ShootingRules.shoot(gameState);
		TestStates.stepBullets(gameState, random, 60);
		ShootingRules.shoot(gameState);
		TestStates.stepBullets(gameState, random, 60);
		expect(gameState.events).toEqual(['shoot', 'rockShrunk', 'shoot', 'rockDestroyed']);
	});

	it('gives the event "crate" when the dinosaur picks up a crate', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.takeEvents();
		gameWorld.state.things = [];
		gameWorld.state.things.push(ThingRules.createCrate(gameWorld.state, 1, 0));
		gameWorld.step(GameSettings.STEP_SECONDS);
		expect(gameWorld.takeEvents()).toEqual(['crate']);
	});

	it('gives the event "hit" when the run ends, and keeps it for the page during a restart', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('start');
		gameWorld.takeEvents();
		gameWorld.state.things = [];
		gameWorld.state.things.push(ThingRules.createRock(gameWorld.state, 1, 0, 'large'));
		gameWorld.step(GameSettings.STEP_SECONDS);
		gameWorld.command('start');
		expect(gameWorld.takeEvents()).toEqual(['hit', 'start']);
	});

	it('gives no event while the world waits', () => {
		const gameWorld = new GameWorld(1);
		gameWorld.command('jump');
		gameWorld.command('shoot');
		TestStates.runSteps(gameWorld, 10);
		expect(gameWorld.takeEvents()).toEqual([]);
	});
});
