///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ViewPalette — the colors of the game
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The colors of the game. Every picture takes its colors from here.
 */
export class ViewPalette {
	/** The color at the top of the sky. */
	static readonly SKY_TOP = '#bfe3f2';

	/** The color of the sky at the horizon. */
	static readonly SKY_BOTTOM = '#f7efdc';

	/** The color of the clouds. */
	static readonly CLOUD = 'rgba(255, 255, 255, 0.85)';

	/** The color of the far mountains. */
	static readonly MOUNTAINS = '#b4c3d6';

	/** The color of the near hills. */
	static readonly HILLS = '#a9c29f';

	/** The color of the ground in the far lane. */
	static readonly GROUND_FAR = '#e4d8b8';

	/** The color of the ground in the middle lane. */
	static readonly GROUND_MIDDLE = '#eadfc2';

	/** The color of the ground in the near lane. */
	static readonly GROUND_NEAR = '#f0e6cc';

	/** The color of the marks on the ground and of the lines between the lanes. */
	static readonly GROUND_MARK = '#cdbd98';

	/** The color of a shadow. */
	static readonly SHADOW = 'rgba(60, 50, 30, 0.2)';

	/** The color of the dinosaur. */
	static readonly DINOSAUR = '#4a4a4a';

	/** The color of the eye of the dinosaur. */
	static readonly EYE = '#ffffff';

	/** The color of a cactus. */
	static readonly CACTUS = '#3f7d4e';

	/** The color of the edge of a rock. */
	static readonly ROCK_DARK = '#656a73';

	/** The color of the middle of a rock. */
	static readonly ROCK = '#8a8f98';

	/** The color of the lit side of a rock. */
	static readonly ROCK_LIGHT = '#a9aeb7';

	/** The color of the edge of a rock that is a merge commit. */
	static readonly MERGE_ROCK_DARK = '#5b4d88';

	/** The color of the middle of a rock that is a merge commit. */
	static readonly MERGE_ROCK = '#7d6bb4';

	/** The color of the lit side of a rock that is a merge commit. */
	static readonly MERGE_ROCK_LIGHT = '#a597d3';

	/** The color of the mark above a merge commit. */
	static readonly MERGE_MARK = '#f2b632';

	/** The color of the edge of the mark above a merge commit. */
	static readonly MERGE_MARK_EDGE = '#8a5d00';

	/** The color of a crate of ammunition. */
	static readonly CRATE = '#b07a3a';

	/** The color of the edge of a crate of ammunition. */
	static readonly CRATE_DARK = '#7d5222';

	/** The color of a shot. */
	static readonly BULLET = '#ff8c1a';

	/** The color of the middle of a shot. */
	static readonly BULLET_CORE = '#fff3c4';

	/** The color of the texts. */
	static readonly TEXT = '#3a3a3a';

	/** The color of the panel behind a message. */
	static readonly PANEL = 'rgba(255, 252, 244, 0.88)';

	/** The color of an empty place for a shot in the counter of ammunition. */
	static readonly AMMUNITION_EMPTY = 'rgba(58, 58, 58, 0.25)';

	/** The colors of the pixels of the dinosaur, by the symbol of the picture. */
	static readonly DINOSAUR_PIXELS: ReadonlyMap<string, string> = new Map([
		['#', ViewPalette.DINOSAUR],
		['e', ViewPalette.EYE],
	]);

	/** The colors of the pixels of the cactus, by the symbol of the picture. */
	static readonly CACTUS_PIXELS: ReadonlyMap<string, string> = new Map([['#', ViewPalette.CACTUS]]);
}
