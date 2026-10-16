import type { DinoRunScenario } from './dino_run_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DinoHitsABoulderScenario — the dinosaur plays five seconds, then runs into a boulder on purpose
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The first video of the folder. The page loads, the page loads again, the player presses Enter, shoots the first large
 * rock three times until the rock is destroyed, goes to the far lane to pass the second large rock, comes back to the
 * middle lane, and does nothing: the dinosaur runs into the next medium rock, and the game over card shows. The commands
 * come from a search with the rules of the game, on the first commits of this repository, which never change.
 */
export class DinoHitsABoulderScenario {
	/**
	 * Makes the scenario.
	 * @returns The scenario.
	 */
	static create(): DinoRunScenario {
		const scenario: DinoRunScenario = {
			name: 'video_game_first',
			seed: 42,
			timedCommands: [
				{
					timeSeconds: 0.3,
					command: 'shoot',
					label: 'First shot at the large rock',
				},
				{
					timeSeconds: 0.6,
					command: 'shoot',
					label: 'Second shot: the rock shrinks',
				},
				{
					timeSeconds: 0.9,
					command: 'shoot',
					label: 'Third shot: the rock shrinks again, then breaks',
				},
				{
					timeSeconds: 3.3,
					command: 'laneUp',
					label: 'Go to the far lane to pass the second large rock',
				},
				{
					timeSeconds: 4.3,
					command: 'laneDown',
					label: 'Come back to the middle lane, in front of the medium rock',
				},
			],
			earliestHitSeconds: 5,
			latestHitSeconds: 6,
			isSoundOn: true,
			requiredEvents: ['rockShrunk', 'rockDestroyed', 'hit'],
		};
		return scenario;
	}
}
