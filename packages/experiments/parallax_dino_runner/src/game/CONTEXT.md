# Directory Context: `/packages/experiments/parallax_dino_runner/src/game`

## Purpose
The rules of the game, with no drawing, no keyboard, and no clock. The page gives the commands of the player to `GameWorld` and calls its step again and again.

## Key Exports & Entry Points
- `game_world.ts`: `GameWorld`, the entry of the folder. It takes the commits, a command, and a step, and it owns the state. `takeEvents` gives the events (`GameEvent`) that happened since the last call, so the page can play a sound for each event.
- `game_settings.ts`: `GameSettings`, every number of the rules: the lanes, the jump, the speed, the sizes of the things, the ammunition, and the speeds of the parallax layers.
- `game_types.ts`: the types of the state: the dinosaur, the things, the bullets, the pieces, and the commands.
- `commit_types.ts`: `CommitRecord`, `CommitFile`, and their Zod schemas. `commit_file_reader.ts`: `CommitFileReader`, which checks the content of the file `commits.json`. `fallback_commits.ts`: `FallbackCommits`, the fake commits.
- `commit_rules.ts`: `CommitRules`: the size of a commit gives its thing, the next commit in front of the dinosaur, and the end of the run.
- `game_state_factory.ts`: `GameStateFactory`, the state of a new run.
- `dinosaur_rules.ts`, `thing_rules.ts`, `thing_generator.ts`, `shooting_rules.ts`, `ammunition_rules.ts`, `collision_rules.ts`, `run_rules.ts`, `parallax_rules.ts`: one class for each rule. A rule class changes only the state that it receives.
- `seeded_random.ts`: `SeededRandom`, the only source of random numbers.

## Rules
- This folder imports from no other folder of `src`, and it uses no browser object.
- A distance and a height are in units. The dinosaur stands at the distance 0, and the world moves toward it, so the distance of each thing gets smaller.
- A random number always comes from `SeededRandom`, never from `Math.random`, so the same seed gives the same world.
- The lane 0 is the far lane, and the lane 2 is the near lane. The dinosaur is always in the one lane that is nearest to its picture, also during a lane change, so a hit always matches the picture (`DinosaurRules.nearestLane`).
- A jump is easy over a cactus, a small rock, and a crate: many moments clear them. A jump over a medium rock clears it only near the top of the jump, so it needs a precise moment. A jump never clears a large rock. `ThingRules.isEasyToJumpOver` and `ThingRules.canJumpOver` tell which, and `tests/jump_difficulty.test.ts` counts the moments.
- A commit is a thing in the lane of the commit. A commit that changes no line is a cactus. Any other commit is a rock, and the lines added plus the lines deleted give its size: `GameSettings.MEDIUM_ROCK_MIN_LINES` and `GameSettings.LARGE_ROCK_MIN_LINES` set the limits. The thing keeps its commit when a shot makes the rock smaller.
- The generator puts the commits one after the other, from the oldest commit to the newest commit, each at its own distance, so the three lanes are never all blocked. Between two commits, a crate sometimes appears. The random numbers decide only the gaps and the crates.
- The run is in the phase "finished" when the dinosaur passes the newest commit: `GameState.lastCommitX` follows the newest commit, and `CommitRules.hasFinished` tests it.
- `GameWorld` needs one commit at least.
- The command "pause" stops the world while it runs, and the phase is "paused". The same command, or the command "start", lets it run again. A paused world ignores the other commands, and its step changes nothing.
- A rule that makes a sound pushes an event in the state, and only the page takes the events. The folder makes no sound.
- A shot makes a rock one size smaller, and a shot at a small rock destroys it. A shot flies through a cactus and through a crate. The test of a hit looks at the whole way of the bullet during the step.

## Background
- The choices of the rules are the first choices of [issue #538](https://github.com/heidrun-org/heidrun/issues/538). A choice changes only in `GameSettings`.
