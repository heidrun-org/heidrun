import { describe, expect, it } from 'vitest';
import { CollisionRules, DinosaurRules, GameSettings, ThingRules } from '../src/index.ts';
import { TestStates } from './test_states.ts';

describe('CollisionRules', () => {
	it('hits a cactus and a rock that stand in the lane of the dinosaur on the ground', () => {
		const gameState = TestStates.createRunning();
		const cactus = ThingRules.createCactus(gameState, 1, 0);
		const rock = ThingRules.createRock(gameState, 1, 10, 'medium');
		expect(CollisionRules.touches(gameState.dinosaur, cactus)).toBe(true);
		expect(CollisionRules.touches(gameState.dinosaur, rock)).toBe(true);
	});

	it('does not hit a thing in another lane, or a thing far away', () => {
		const gameState = TestStates.createRunning();
		const otherLane = ThingRules.createCactus(gameState, 0, 0);
		const farAway = ThingRules.createCactus(gameState, 1, 200);
		expect(CollisionRules.touches(gameState.dinosaur, otherLane)).toBe(false);
		expect(CollisionRules.touches(gameState.dinosaur, farAway)).toBe(false);
	});

	it('lets the dinosaur jump over a cactus and over a small rock', () => {
		const gameState = TestStates.createRunning();
		const cactus = ThingRules.createCactus(gameState, 1, 0);
		const smallRock = ThingRules.createRock(gameState, 1, 0, 'small');
		gameState.dinosaur.height = GameSettings.JUMP_HEIGHT - 1;
		expect(CollisionRules.touches(gameState.dinosaur, cactus)).toBe(false);
		expect(CollisionRules.touches(gameState.dinosaur, smallRock)).toBe(false);
	});

	it('lets the dinosaur jump over a medium rock only when the dinosaur is higher than the rock', () => {
		const gameState = TestStates.createRunning();
		const mediumRock = ThingRules.createRock(gameState, 1, 0, 'medium');
		gameState.dinosaur.height = GameSettings.MEDIUM_ROCK_HEIGHT - 1;
		expect(CollisionRules.touches(gameState.dinosaur, mediumRock)).toBe(true);
		gameState.dinosaur.height = GameSettings.MEDIUM_ROCK_HEIGHT + 1;
		expect(CollisionRules.touches(gameState.dinosaur, mediumRock)).toBe(false);
	});

	it('never lets the dinosaur jump over a large rock, even at the top of a jump', () => {
		const gameState = TestStates.createRunning();
		const largeRock = ThingRules.createRock(gameState, 1, 0, 'large');
		gameState.dinosaur.height = GameSettings.JUMP_HEIGHT;
		expect(CollisionRules.touches(gameState.dinosaur, largeRock)).toBe(true);
	});

	it('puts the dinosaur in the lane that it is nearest to, as it is drawn', () => {
		const dinosaur = DinosaurRules.create();
		dinosaur.lanePosition = 1.4;
		expect(CollisionRules.isInLane(dinosaur, 0)).toBe(false);
		expect(CollisionRules.isInLane(dinosaur, 1)).toBe(true);
		expect(CollisionRules.isInLane(dinosaur, 2)).toBe(false);
		dinosaur.lanePosition = 1.6;
		expect(CollisionRules.isInLane(dinosaur, 1)).toBe(false);
		expect(CollisionRules.isInLane(dinosaur, 2)).toBe(true);
		dinosaur.lanePosition = 2;
		expect(CollisionRules.isInLane(dinosaur, 1)).toBe(false);
		expect(CollisionRules.isInLane(dinosaur, 2)).toBe(true);
	});

	it('is in exactly one lane at every lane position', () => {
		const dinosaur = DinosaurRules.create();
		for (let lanePosition = 0; lanePosition <= 2; lanePosition += 0.01) {
			dinosaur.lanePosition = lanePosition;
			const lanes = [0, 1, 2].filter((lane) => CollisionRules.isInLane(dinosaur, lane));
			expect(lanes).toHaveLength(1);
			expect(Math.abs(lanes[0] - lanePosition)).toBeLessThanOrEqual(0.5);
		}
	});

	it('does not hit a rock of the lane that the dinosaur has already left', () => {
		const gameState = TestStates.createRunning();
		const rockOfNearLane = ThingRules.createRock(gameState, 2, 0, 'small');
		const rockOfMiddleLane = ThingRules.createRock(gameState, 1, 0, 'small');
		gameState.dinosaur.lanePosition = 1.1;
		gameState.dinosaur.targetLane = 1;
		expect(CollisionRules.touches(gameState.dinosaur, rockOfNearLane)).toBe(false);
		expect(CollisionRules.touches(gameState.dinosaur, rockOfMiddleLane)).toBe(true);
	});

	it('does not hit a rock of the lane that the dinosaur has not yet entered', () => {
		const gameState = TestStates.createRunning();
		const rockOfNearLane = ThingRules.createRock(gameState, 2, 0, 'small');
		gameState.dinosaur.lanePosition = 1.1;
		gameState.dinosaur.targetLane = 2;
		expect(CollisionRules.touches(gameState.dinosaur, rockOfNearLane)).toBe(false);
	});

	it('picks up a crate, adds the ammunition, and never goes over the maximum', () => {
		const gameState = TestStates.createRunning();
		gameState.things.push(ThingRules.createCrate(gameState, 1, 0));
		gameState.ammunition = 2;
		expect(CollisionRules.resolve(gameState)).toBe(false);
		expect(gameState.ammunition).toBe(2 + GameSettings.CRATE_AMMUNITION);
		expect(gameState.things).toHaveLength(0);

		gameState.things.push(ThingRules.createCrate(gameState, 1, 0));
		gameState.ammunition = GameSettings.MAX_AMMUNITION - 1;
		CollisionRules.resolve(gameState);
		expect(gameState.ammunition).toBe(GameSettings.MAX_AMMUNITION);
	});

	it('does not pick up a crate when the dinosaur jumps over it', () => {
		const gameState = TestStates.createRunning();
		gameState.things.push(ThingRules.createCrate(gameState, 1, 0));
		gameState.dinosaur.height = 60;
		CollisionRules.resolve(gameState);
		expect(gameState.ammunition).toBe(GameSettings.START_AMMUNITION);
		expect(gameState.things).toHaveLength(1);
	});

	it('reports a hit when a rock touches the dinosaur', () => {
		const gameState = TestStates.createWithRock(1, 0, 'large');
		expect(CollisionRules.resolve(gameState)).toBe(true);
	});
});
