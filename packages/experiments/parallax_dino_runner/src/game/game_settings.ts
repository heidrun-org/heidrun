///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GameSettings — every number that sets the feel of the game
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Every number that sets the feel of the game. A distance and a height are in units. A duration is in seconds.
 * Change a number here to change the game: no other file holds a number of the rules.
 */
export class GameSettings {
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Time
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** The duration of one step of the rules, in seconds: one sixtieth of a second. */
	static readonly STEP_SECONDS = 1 / 60;

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Lanes and dinosaur
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** The number of lanes. The lane 0 is the far lane, and the lane 2 is the near lane. */
	static readonly LANE_COUNT = 3;

	/** The lane where the dinosaur starts: the middle lane. */
	static readonly START_LANE = 1;

	/** The time that the dinosaur needs to go from one lane to the next lane, in seconds. */
	static readonly LANE_CHANGE_SECONDS = 0.15;

	/** The tolerance that tells whether the dinosaur is in a lane, in lanes. */
	static readonly LANE_TOLERANCE = 0.000001;

	/** The upward speed of a jump, in units per second. */
	static readonly JUMP_SPEED = 912;

	/** The downward acceleration of a jump, in units per second squared. */
	static readonly GRAVITY = 3200;

	/** The height of the top of a jump, in units. The dinosaur cannot jump over a thing that is this high or higher. */
	static readonly JUMP_HEIGHT = GameSettings.JUMP_SPEED ** 2 / (2 * GameSettings.GRAVITY);

	/** A thing this high or lower is easy to jump over: the jump has a lot of room for error. */
	static readonly EASY_JUMP_HEIGHT = 60;

	/** The width of the part of the dinosaur that can hit a thing, in units. */
	static readonly DINOSAUR_WIDTH = 36;

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Speed and score
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** The speed of the world at the start of a run, in units per second. */
	static readonly START_SPEED = 420;

	/** The highest speed of the world, in units per second. */
	static readonly MAX_SPEED = 800;

	/** The speed that the world gains for each unit of distance, in units per second. */
	static readonly SPEED_GAIN_PER_UNIT = 0.02;

	/** The distance that gives one point of score, in units. */
	static readonly UNITS_PER_SCORE_POINT = 10;

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Things in the lanes
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** The distance in front of the dinosaur where a new row of things appears, in units. */
	static readonly SPAWN_X = 1500;

	/** The distance behind the dinosaur where a thing disappears, in units. */
	static readonly REMOVE_X = -300;

	/** The distance of the first row of things at the start of a run, in units. */
	static readonly FIRST_ROW_X = 900;

	/** The smallest distance between two rows of things, in units. */
	static readonly MINIMUM_GAP = 480;

	/** The time that the dinosaur needs to cross the gap between two rows at the least, in seconds. */
	static readonly GAP_SECONDS = 0.9;

	/** The largest random addition to the gap between two rows, in units. */
	static readonly GAP_RANDOM = 420;

	/** The chance that a lane of a row stays empty, from 0 to 1. */
	static readonly EMPTY_LANE_CHANCE = 0.5;

	/** The chance that a lane of a row holds a cactus, from 0 to 1. The other lanes hold a rock. */
	static readonly CACTUS_CHANCE = 0.2;

	/** The chance that a rock is small, from 0 to 1. */
	static readonly SMALL_ROCK_CHANCE = 0.4;

	/** The chance that a rock is medium, from 0 to 1. The other rocks are large. */
	static readonly MEDIUM_ROCK_CHANCE = 0.35;

	/** The chance that a row also holds a crate of ammunition in an empty lane, from 0 to 1. */
	static readonly CRATE_ROW_CHANCE = 0.25;

	/** The width of a cactus, in units. */
	static readonly CACTUS_WIDTH = 28;

	/** The height of a cactus, in units. */
	static readonly CACTUS_HEIGHT = 52;

	/** The width of a small rock, in units. */
	static readonly SMALL_ROCK_WIDTH = 44;

	/** The height of a small rock, in units. */
	static readonly SMALL_ROCK_HEIGHT = 40;

	/** The width of a medium rock, in units. */
	static readonly MEDIUM_ROCK_WIDTH = 80;

	/** The height of a medium rock, in units. A jump clears it only near the top of the jump, so it is hard. */
	static readonly MEDIUM_ROCK_HEIGHT = 88;

	/** The width of a large rock, in units. */
	static readonly LARGE_ROCK_WIDTH = 120;

	/** The height of a large rock, in units. It is higher than a jump and higher than the dinosaur at its top. */
	static readonly LARGE_ROCK_HEIGHT = 190;

	/** The width of a crate of ammunition, in units. */
	static readonly CRATE_WIDTH = 30;

	/** The height of a crate of ammunition, in units. */
	static readonly CRATE_HEIGHT = 30;

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Shooting
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** The number of shots that the player has at the start of a run. */
	static readonly START_AMMUNITION = 5;

	/** The number of shots that one crate gives. */
	static readonly CRATE_AMMUNITION = 3;

	/** The largest number of shots that the player can have. */
	static readonly MAX_AMMUNITION = 9;

	/** The speed of a shot, in units per second, in the frame of the dinosaur. */
	static readonly BULLET_SPEED = 1400;

	/** The distance in front of the dinosaur where a shot starts, in units. */
	static readonly BULLET_START_X = 24;

	/** The distance in front of the dinosaur where a shot disappears, in units. */
	static readonly BULLET_MAX_X = 1700;

	/** The number of pieces that one shot breaks off a rock. */
	static readonly PIECES_PER_SHOT = 6;

	/** The downward acceleration of a piece of a rock, in units per second squared. */
	static readonly PIECE_GRAVITY = 1800;

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Parallax
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** The speed of the sky layer, as a part of the speed of the ground. */
	static readonly PARALLAX_SKY = 0.1;

	/** The speed of the far mountains layer, as a part of the speed of the ground. */
	static readonly PARALLAX_MOUNTAINS = 0.25;

	/** The speed of the near hills layer, as a part of the speed of the ground. */
	static readonly PARALLAX_HILLS = 0.5;

	/** The speed of the ground layer, as a part of the speed of the ground. */
	static readonly PARALLAX_GROUND = 1;
}
