# Directory Context: `/packages/experiments/parallax_dino_runner/src/game`

## Purpose
The rules of the game, with no drawing, no keyboard, and no clock. The page gives the commands of the player to `GameWorld` and calls its step again and again.

## Key Exports & Entry Points
- `game_world.ts`: `GameWorld`, the entry of the folder. It takes a command, runs one step, and owns the state. `takeEvents` gives the events (`GameEvent`) that happened since the last call, so the page can play a sound for each event.
- `game_settings.ts`: `GameSettings`, every number of the rules: the lanes, the jump, the speed, the sizes of the things, the ammunition, and the speeds of the parallax layers.
- `game_types.ts`: the types of the state: the dinosaur, the things, the bullets, the pieces, and the commands.
- `game_state_factory.ts`: `GameStateFactory`, the state of a new run.
- `dinosaur_rules.ts`, `thing_rules.ts`, `thing_generator.ts`, `shooting_rules.ts`, `ammunition_rules.ts`, `collision_rules.ts`, `run_rules.ts`, `parallax_rules.ts`: one class for each rule. A rule class changes only the state that it receives.
- `seeded_random.ts`: `SeededRandom`, the only source of random numbers.

## Rules
- This folder imports from no other folder of `src`, and it uses no browser object.
- A distance and a height are in units. The dinosaur stands at the distance 0, and the world moves toward it, so the distance of each thing gets smaller.
- A random number always comes from `SeededRandom`, never from `Math.random`, so the same seed gives the same world.
- The lane 0 is the far lane, and the lane 2 is the near lane. The dinosaur is in two lanes during a lane change.
- A jump is easy over a cactus, a small rock, and a crate: many moments clear them. A jump over a medium rock clears it only near the top of the jump, so it needs a precise moment. A jump never clears a large rock. `ThingRules.isEasyToJumpOver` and `ThingRules.canJumpOver` tell which, and `tests/jump_difficulty.test.ts` counts the moments.
- The generator never blocks the three lanes of a row with things that are not easy to jump over.
- A rule that makes a sound pushes an event in the state, and only the page takes the events. The folder makes no sound.
- A shot makes a rock one size smaller, and a shot at a small rock destroys it. A shot flies through a cactus and through a crate. The test of a hit looks at the whole way of the bullet during the step.

## Background
- The choices of the rules are the first choices of [issue #538](https://github.com/heidrun-org/heidrun/issues/538). A choice changes only in `GameSettings`.
