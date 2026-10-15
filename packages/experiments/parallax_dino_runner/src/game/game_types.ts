///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GameTypes — the shapes of the data of the game
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

import type { CommitRecord } from './commit_types.ts';

/**
 * The phase of the game. In the phase "ready", the world waits for the player. In the phase "running", the world
 * moves. In the phase "paused", the player stopped the world, and the world goes on from the same place. In the phase
 * "over", the dinosaur hit something and the world stops. In the phase "finished", the dinosaur passed the newest
 * commit and the world stops.
 */
export type GamePhase = 'ready' | 'running' | 'paused' | 'over' | 'finished';

/**
 * A command that the player gives to the game.
 */
export type GameCommand = 'start' | 'pause' | 'jump' | 'laneUp' | 'laneDown' | 'shoot';

/**
 * Something that happened during the game, for the sounds. The state keeps the events until the page takes them.
 */
export type GameEvent =
	| 'start'
	| 'jump'
	| 'laneChange'
	| 'shoot'
	| 'shootEmpty'
	| 'rockShrunk'
	| 'rockDestroyed'
	| 'crate'
	| 'hit'
	| 'finish';

/**
 * The size of a rock.
 */
export type RockSize = 'small' | 'medium' | 'large';

/**
 * The kind of a thing that stands in a lane.
 */
export type ThingKind = 'cactus' | 'rock' | 'crate';

/**
 * The dinosaur. It always stands at the distance 0, and the world moves toward it.
 */
export type Dinosaur = {
	/** The lane of the dinosaur, from 0 (far lane) to 2 (near lane). It is not a whole number during a lane change. */
	lanePosition: number;
	/** The lane where the dinosaur goes. It is always a whole number. */
	targetLane: number;
	/** The height of the feet above the ground, in units. */
	height: number;
	/** The upward speed, in units per second. It is negative while the dinosaur falls. */
	verticalSpeed: number;
};

/**
 * A thing that stands in one lane and moves toward the dinosaur: a cactus, a rock, or a crate of ammunition. A cactus
 * or a rock is a commit.
 */
export type Thing = {
	/** The number that tells this thing from every other thing of the run. */
	id: number;
	/** The kind of the thing. */
	kind: ThingKind;
	/** The size of the rock. It is null when the thing is not a rock. */
	rockSize: RockSize | null;
	/** The commit that this thing stands for. It is null for a crate. */
	commit: CommitRecord | null;
	/** The lane of the thing, from 0 (far lane) to 2 (near lane). */
	lane: number;
	/** The distance in front of the dinosaur, in units, measured from the middle of the thing. */
	x: number;
	/** The width of the thing, in units. */
	width: number;
	/** The height of the thing, in units. */
	height: number;
};

/**
 * A shot that goes to the right, in one lane.
 */
export type Bullet = {
	/** The number that tells this bullet from every other bullet of the run. */
	id: number;
	/** The lane of the bullet. */
	lane: number;
	/** The distance in front of the dinosaur, in units. */
	x: number;
};

/**
 * A piece of a broken rock. A piece is only for the picture: it never hits the dinosaur.
 */
export type Piece = {
	/** The number that tells this piece from every other piece of the run. */
	id: number;
	/** The lane of the piece. */
	lane: number;
	/** The distance in front of the dinosaur, in units. */
	x: number;
	/** The height above the ground, in units. */
	height: number;
	/** The speed to the right, in units per second, in the frame of the dinosaur. */
	speedX: number;
	/** The upward speed, in units per second. */
	speedY: number;
	/** The width and the height of the piece, in units. */
	size: number;
};

/**
 * The width and the height of a thing, in units.
 */
export type ThingDimensions = {
	/** The width, in units. */
	width: number;
	/** The height, in units. */
	height: number;
};

/**
 * Everything that changes during a run of the game.
 */
export type GameState = {
	/** The phase of the game. */
	phase: GamePhase;
	/** The dinosaur. */
	dinosaur: Dinosaur;
	/** The things in the lanes. */
	things: Thing[];
	/** The shots that fly. */
	bullets: Bullet[];
	/** The pieces of broken rocks that fly. */
	pieces: Piece[];
	/** The distance that the world went through since the start of the run, in units. */
	distance: number;
	/** The speed of the world, in units per second. */
	speed: number;
	/** The distance in front of the dinosaur of the newest commit, in units. It is null until that commit appears. */
	lastCommitX: number | null;
	/** The number of shots that the player has. */
	ammunition: number;
	/** The best score of this page. */
	bestScore: number;
	/** The number for the next thing, bullet, or piece. */
	nextId: number;
	/** The events that happened and that the page did not take yet. */
	events: GameEvent[];
};
