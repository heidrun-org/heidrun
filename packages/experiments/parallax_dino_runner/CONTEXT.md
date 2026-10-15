# Directory Context: `/packages/experiments/parallax_dino_runner`

## Purpose
An experiment: a static web page with a game. A dinosaur like the dinosaur of Chrome Dino runs to the right in a flat world with three lanes, in front of parallax layers. The player jumps, changes lane, and shoots. The things in the lanes are the commits of a Git repository, from the oldest commit to the newest commit. The world never goes up or down: this is stage 2 of the video game, and the force graph comes later.

## Key Exports & Entry Points
- `src/index.ts`: the public interface for another package of `packages/experiments`. It exports `GameWorld`, `GameSettings`, the rules classes, the commit types, and the types of the folder `src/game`.
- `src/game/`: the rules of the game, with no browser code — see its own CONTEXT.md.
- `src/view/`: the page: the drawing, the keyboard, and the game loop — see its own CONTEXT.md.
- `src/commit_export/`: the script that reads the Git history of a folder and writes the file `public/commits.json` — see its own CONTEXT.md.
- `index.html`: the page, which loads `src/view/game_page.ts`.
- `README.md`: how a person makes the game for another repository and puts it on a server of static files.
- `tests/`: the Vitest tests. `tests/test_states.ts` makes small states and small runs, and `tests/test_git_repository.ts` makes a small real Git repository. Only the tests import them.
- Command to write the commits of this repository: `pnpm experiment:parallax_dino_runner:commits`. Add `--git-folder <path>` for another repository.
- Command to play: `pnpm experiment:parallax_dino_runner` at the root of the repository. Add `?seed=42` to the address of the page to play the same world again.
- Command to build the static folder `dist`: `pnpm --filter parallax_dino_runner build`
- Command to test this folder: `pnpm --filter parallax_dino_runner test`
- Command to check the types: `pnpm --filter parallax_dino_runner exec tsc --noEmit`

## Rules
- The page is static files only. Its one request is for the file `commits.json`, with a relative address, and every address of the build is relative (`base: './'` in `vite.config.ts`), so the folder `dist` works in any place of a server of static files. `tests/static_build.test.ts` tests this.
- When the file `commits.json` is missing or wrong, the page plays with fake commits, so the game always plays.
- The file `public/commits.json` holds the history of a repository, so Git ignores it.
- The package depends on Zod only, which checks the file `commits.json`. Its other packages are development tools: Vite, TypeScript, Vitest, tsx, and Commander.
- The package imports no other package of the repository, and it needs no SQLite file: the script runs the command `git` itself.
- `src/game/` never imports `src/view/` or `src/commit_export/`.
- Only `GameWorld` changes the state of the game while the game runs. The folder `src/view/` only reads the state.
- Every number that sets the feel of the game is in `GameSettings`, and no other file of `src/game/` holds one.
- The code draws every picture and makes every sound. The package has no image file and no sound file.
- The tests test `src/game/`, `src/commit_export/`, the build, and the shape of the pixel pictures of `src/view/sprite_frames.ts`. They do not test the drawing.

## Background
- The package comes from [issue #536](https://github.com/heidrun-org/heidrun/issues/536), the first stage of the full game of [issue #537](https://github.com/heidrun-org/heidrun/issues/537).
- The plan of stage 1 is [issue #538](https://github.com/heidrun-org/heidrun/issues/538), and the plan of stage 2 is [issue #540](https://github.com/heidrun-org/heidrun/issues/540).
