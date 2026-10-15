import { AmmunitionRules } from './ammunition_rules.ts';
import { DinosaurRules } from './dinosaur_rules.ts';
import { GameSettings } from './game_settings.ts';
import type { Bullet, GameState, Piece, Thing } from './game_types.ts';
import type { SeededRandom } from './seeded_random.ts';
import { ThingRules } from './thing_rules.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ShootingRules — the shots, the rocks that get smaller, and the pieces that fly
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The rules of shooting. A shot flies to the right in one lane. A shot that touches a rock makes the rock one size
 * smaller, and a shot at a small rock destroys it. A shot flies through a cactus and through a crate.
 */
export class ShootingRules {
	/**
	 * Shoots one bullet in the lane of the dinosaur. With no ammunition, nothing flies, and the event "shootEmpty"
	 * tells it.
	 * @param gameState The state of the game.
	 * @returns True when a bullet flies.
	 */
	static shoot(gameState: GameState): boolean {
		if (AmmunitionRules.spend(gameState) === false) {
			gameState.events.push('shootEmpty');
			return false;
		}
		const bullet: Bullet = {
			id: ThingRules.takeId(gameState),
			lane: DinosaurRules.shootingLane(gameState.dinosaur),
			x: GameSettings.BULLET_START_X,
		};
		gameState.bullets.push(bullet);
		gameState.events.push('shoot');
		return true;
	}

	/**
	 * Moves the bullets for one step and applies the hits. The test of a hit looks at the whole way of the bullet and
	 * of the rock during the step, so a fast bullet never flies through a rock.
	 * @param gameState The state of the game.
	 * @param seconds The duration of the step, in seconds.
	 * @param distanceMoved The distance that the world went through in this step, in units.
	 * @param random The random number generator for the pieces of a rock.
	 */
	static stepBullets(gameState: GameState, seconds: number, distanceMoved: number, random: SeededRandom): void {
		for (const bullet of [...gameState.bullets]) {
			const previousX = bullet.x;
			bullet.x += GameSettings.BULLET_SPEED * seconds;
			const rock = ShootingRules._findHitRock(gameState, bullet, previousX, distanceMoved);
			if (rock !== null) {
				ShootingRules.hitRock(gameState, rock, random);
				ShootingRules._removeBullet(gameState, bullet);
				continue;
			}
			if (bullet.x > GameSettings.BULLET_MAX_X) {
				ShootingRules._removeBullet(gameState, bullet);
			}
		}
	}

	/**
	 * Applies one shot to a rock: the rock breaks into pieces, then it becomes one size smaller or it disappears.
	 * @param gameState The state of the game.
	 * @param rock The rock that the shot hit.
	 * @param random The random number generator for the pieces.
	 */
	static hitRock(gameState: GameState, rock: Thing, random: SeededRandom): void {
		ShootingRules._breakPieces(gameState, rock, random);
		if (rock.rockSize === null) {
			return;
		}
		const smallerSize = ThingRules.smallerSize(rock.rockSize);
		if (smallerSize === null) {
			ThingRules.remove(gameState.things, rock);
			gameState.events.push('rockDestroyed');
			return;
		}
		ThingRules.resize(rock, smallerSize);
		gameState.events.push('rockShrunk');
	}

	/**
	 * Moves the pieces of the broken rocks for one step. A piece disappears when it lands.
	 * @param gameState The state of the game.
	 * @param seconds The duration of the step, in seconds.
	 * @param distanceMoved The distance that the world went through in this step, in units.
	 */
	static stepPieces(gameState: GameState, seconds: number, distanceMoved: number): void {
		for (const piece of gameState.pieces) {
			piece.x += piece.speedX * seconds - distanceMoved;
			piece.height += piece.speedY * seconds - 0.5 * GameSettings.PIECE_GRAVITY * seconds * seconds;
			piece.speedY -= GameSettings.PIECE_GRAVITY * seconds;
		}
		gameState.pieces = gameState.pieces.filter((piece) => {
			return piece.height > 0 && piece.x > GameSettings.REMOVE_X;
		});
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Finds the nearest rock that a bullet touched during the step.
	 * @param gameState The state of the game.
	 * @param bullet The bullet, already moved.
	 * @param previousX The distance of the bullet before the step, in units.
	 * @param distanceMoved The distance that the world went through in this step, in units.
	 * @returns The rock, or null when the bullet touched no rock.
	 */
	private static _findHitRock(
		gameState: GameState,
		bullet: Bullet,
		previousX: number,
		distanceMoved: number,
	): Thing | null {
		let nearestRock: Thing | null = null;
		for (const thing of gameState.things) {
			if (thing.kind !== 'rock' || thing.lane !== bullet.lane) {
				continue;
			}
			const rockFrontX = thing.x - thing.width / 2;
			const rockPreviousBackX = thing.x + distanceMoved + thing.width / 2;
			if (bullet.x < rockFrontX || previousX > rockPreviousBackX) {
				continue;
			}
			if (nearestRock === null || thing.x < nearestRock.x) {
				nearestRock = thing;
			}
		}
		return nearestRock;
	}

	/**
	 * Throws pieces off a rock that a shot hit.
	 * @param gameState The state of the game.
	 * @param rock The rock.
	 * @param random The random number generator for the pieces.
	 */
	private static _breakPieces(gameState: GameState, rock: Thing, random: SeededRandom): void {
		for (let index = 0; index < GameSettings.PIECES_PER_SHOT; index += 1) {
			const piece: Piece = {
				id: ThingRules.takeId(gameState),
				lane: rock.lane,
				x: rock.x + random.range(-rock.width / 2, rock.width / 2),
				height: random.range(0, rock.height),
				speedX: random.range(-150, 250),
				speedY: random.range(200, 520),
				size: random.range(5, 12),
			};
			gameState.pieces.push(piece);
		}
	}

	/**
	 * Takes a bullet out of the state.
	 * @param gameState The state of the game.
	 * @param bullet The bullet.
	 */
	private static _removeBullet(gameState: GameState, bullet: Bullet): void {
		const index = gameState.bullets.indexOf(bullet);
		if (index >= 0) {
			gameState.bullets.splice(index, 1);
		}
	}
}
