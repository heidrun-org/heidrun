import { describe, expect, it } from 'vitest';
import { GameSettings, SeededRandom, ShootingRules, ThingRules } from '../src/index.ts';
import { TestStates } from './test_states.ts';

describe('ShootingRules', () => {
	it('uses one unit of ammunition for each shot', () => {
		const gameState = TestStates.createRunning();
		expect(ShootingRules.shoot(gameState)).toBe(true);
		expect(gameState.ammunition).toBe(GameSettings.START_AMMUNITION - 1);
		expect(gameState.bullets).toHaveLength(1);
		expect(gameState.bullets[0].lane).toBe(1);
	});

	it('does not shoot with no ammunition', () => {
		const gameState = TestStates.createRunning();
		gameState.ammunition = 0;
		expect(ShootingRules.shoot(gameState)).toBe(false);
		expect(gameState.bullets).toHaveLength(0);
	});

	it('makes a large rock one size smaller with each shot, then destroys it', () => {
		const random = new SeededRandom(1);
		const gameState = TestStates.createWithRock(1, 400, 'large');
		const rock = gameState.things[0];

		ShootingRules.shoot(gameState);
		TestStates.stepBullets(gameState, random, 60);
		expect(rock.rockSize).toBe('medium');
		expect(rock.height).toBe(GameSettings.MEDIUM_ROCK_HEIGHT);

		ShootingRules.shoot(gameState);
		TestStates.stepBullets(gameState, random, 60);
		expect(rock.rockSize).toBe('small');
		expect(ThingRules.isEasyToJumpOver(rock)).toBe(true);

		ShootingRules.shoot(gameState);
		TestStates.stepBullets(gameState, random, 60);
		expect(gameState.things).toHaveLength(0);
		expect(gameState.bullets).toHaveLength(0);
	});

	it('throws pieces off a rock that a shot hits', () => {
		const random = new SeededRandom(1);
		const gameState = TestStates.createWithRock(1, 400, 'medium');
		ShootingRules.shoot(gameState);
		TestStates.stepBullets(gameState, random, 60);
		expect(gameState.pieces).toHaveLength(GameSettings.PIECES_PER_SHOT);
	});

	it('removes the pieces when they land', () => {
		const random = new SeededRandom(1);
		const gameState = TestStates.createWithRock(1, 400, 'small');
		ShootingRules.shoot(gameState);
		TestStates.stepBullets(gameState, random, 60);
		for (let index = 0; index < 120; index += 1) {
			ShootingRules.stepPieces(gameState, GameSettings.STEP_SECONDS, 0);
		}
		expect(gameState.pieces).toHaveLength(0);
	});

	it('does not hit a rock in another lane', () => {
		const random = new SeededRandom(1);
		const gameState = TestStates.createWithRock(0, 400, 'large');
		ShootingRules.shoot(gameState);
		TestStates.stepBullets(gameState, random, 120);
		expect(gameState.things[0].rockSize).toBe('large');
	});

	it('flies through a cactus and through a crate', () => {
		const random = new SeededRandom(1);
		const gameState = TestStates.createRunning();
		gameState.things.push(ThingRules.createCactus(gameState, 1, 300));
		gameState.things.push(ThingRules.createCrate(gameState, 1, 500));
		ShootingRules.shoot(gameState);
		TestStates.stepBullets(gameState, random, 60);
		expect(gameState.things).toHaveLength(2);
	});

	it('hits the nearest rock first', () => {
		const random = new SeededRandom(1);
		const gameState = TestStates.createWithRock(1, 700, 'large');
		gameState.things.push(ThingRules.createRock(gameState, 1, 300, 'large'));
		ShootingRules.shoot(gameState);
		TestStates.stepBullets(gameState, random, 60);
		expect(gameState.things[0].rockSize).toBe('large');
		expect(gameState.things[1].rockSize).toBe('medium');
	});

	it('does not fly through a rock that moves toward the bullet at a high speed', () => {
		const random = new SeededRandom(1);
		const gameState = TestStates.createWithRock(1, 100, 'small');
		ShootingRules.shoot(gameState);
		const distanceMoved = GameSettings.MAX_SPEED * GameSettings.STEP_SECONDS;
		for (let index = 0; index < 20; index += 1) {
			for (const thing of gameState.things) {
				thing.x -= distanceMoved;
			}
			ShootingRules.stepBullets(gameState, GameSettings.STEP_SECONDS, distanceMoved, random);
		}
		expect(gameState.things).toHaveLength(0);
	});
});
