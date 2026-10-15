# Directory Context: `/packages/experiments/parallax_dino_runner`

## Purpose
An experiment: a static web page with a game. A dinosaur like the dinosaur of Chrome Dino runs to the right in a flat world with three lanes, in front of parallax layers. The player jumps, changes lane, and shoots rocks. This is stage 1 of the video game: the world has no Git data, and it never goes up or down.

## Key Exports & Entry Points
- `src/index.ts`: the public interface for another package of `packages/experiments`. It exports `GameWorld`, `GameSettings`, the rules classes, and the types of the folder `src/game`.
- `src/game/`: the rules of the game, with no browser code — see its own CONTEXT.md.
- `src/view/`: the page: the drawing, the keyboard, and the game loop — see its own CONTEXT.md.
- `index.html`: the page, which loads `src/view/game_page.ts`.
- `tests/`: the Vitest tests. `tests/test_states.ts` makes small states and small runs, and only the tests import it.
- Command to play: `pnpm experiment:parallax_dino_runner` at the root of the repository. Add `?seed=42` to the address of the page to play the same world again.
- Command to test this folder: `pnpm --filter parallax_dino_runner test`
- Command to check the types: `pnpm --filter parallax_dino_runner exec tsc --noEmit`

## Rules
- The package has no dependency at run time. It has only development tools: Vite, TypeScript, and Vitest.
- The package imports no other package of the repository.
- `src/game/` never imports `src/view/`.
- Only `GameWorld` changes the state of the game while the game runs. The folder `src/view/` only reads the state.
- Every number that sets the feel of the game is in `GameSettings`, and no other file of `src/game/` holds one.
- The code draws every picture and makes every sound. The package has no image file and no sound file.
- The tests test `src/game/` and the shape of the pixel pictures of `src/view/sprite_frames.ts`. They do not test the drawing.

## Background
- The package comes from [issue #536](https://github.com/heidrun-org/heidrun/issues/536), the first stage of the full game of [issue #537](https://github.com/heidrun-org/heidrun/issues/537).
- The plan is [issue #538](https://github.com/heidrun-org/heidrun/issues/538).
