import { describe, expect, it } from 'vitest';
import { DinosaurRules, GameSettings } from '../src/index.ts';

describe('DinosaurRules', () => {
	it('starts in the middle lane, on the ground', () => {
		const dinosaur = DinosaurRules.create();
		expect(dinosaur.lanePosition).toBe(1);
		expect(dinosaur.targetLane).toBe(1);
		expect(DinosaurRules.isOnGround(dinosaur)).toBe(true);
	});

	it('stops the lane change at the first lane and at the last lane', () => {
		const dinosaur = DinosaurRules.create();
		DinosaurRules.changeLane(dinosaur, -1);
		DinosaurRules.changeLane(dinosaur, -1);
		DinosaurRules.changeLane(dinosaur, -1);
		expect(dinosaur.targetLane).toBe(0);
		DinosaurRules.changeLane(dinosaur, 1);
		DinosaurRules.changeLane(dinosaur, 1);
		DinosaurRules.changeLane(dinosaur, 1);
		DinosaurRules.changeLane(dinosaur, 1);
		expect(dinosaur.targetLane).toBe(2);
	});

	it('reaches the new lane in the time of a lane change, and never goes past it', () => {
		const dinosaur = DinosaurRules.create();
		DinosaurRules.changeLane(dinosaur, 1);
		DinosaurRules.step(dinosaur, GameSettings.LANE_CHANGE_SECONDS / 2);
		expect(dinosaur.lanePosition).toBeCloseTo(1.5, 5);
		DinosaurRules.step(dinosaur, GameSettings.LANE_CHANGE_SECONDS);
		expect(dinosaur.lanePosition).toBe(2);
	});

	it('shoots in the nearest lane', () => {
		const dinosaur = DinosaurRules.create();
		dinosaur.lanePosition = 1.4;
		expect(DinosaurRules.shootingLane(dinosaur)).toBe(1);
		dinosaur.lanePosition = 1.6;
		expect(DinosaurRules.shootingLane(dinosaur)).toBe(2);
	});

	it('jumps to the height of the setting, then lands', () => {
		const dinosaur = DinosaurRules.create();
		expect(DinosaurRules.jump(dinosaur)).toBe(true);
		let highest = 0;
		let stepCount = 0;
		do {
			DinosaurRules.step(dinosaur, GameSettings.STEP_SECONDS);
			highest = Math.max(highest, dinosaur.height);
			stepCount += 1;
		} while (DinosaurRules.isOnGround(dinosaur) === false && stepCount < 1000);
		expect(highest).toBeGreaterThan(GameSettings.JUMP_HEIGHT - 2);
		expect(highest).toBeLessThanOrEqual(GameSettings.JUMP_HEIGHT);
		expect(dinosaur.height).toBe(0);
		expect(stepCount).toBeLessThan(60);
	});

	it('cannot jump again in the air', () => {
		const dinosaur = DinosaurRules.create();
		DinosaurRules.jump(dinosaur);
		DinosaurRules.step(dinosaur, GameSettings.STEP_SECONDS);
		const speedBefore = dinosaur.verticalSpeed;
		expect(DinosaurRules.jump(dinosaur)).toBe(false);
		expect(dinosaur.verticalSpeed).toBe(speedBefore);
	});
});
