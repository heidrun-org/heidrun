# Parallax dino runner

A small game. A dinosaur runs through the history of a Git repository. Each commit is a rock or a cactus in front of the dinosaur. A big commit is a big rock. A merge commit is a purple rock with a gold diamond. The player jumps, changes lane, and shoots.

The game is static files only. It needs no server code and no network. You can make it for your own repository, and put it anywhere that serves static files, for example on GitHub Pages.

## Play it here

```bash
pnpm experiment:parallax_dino_runner:commits
pnpm experiment:parallax_dino_runner
```

The first command reads the Git history of this repository and writes the file `public/commits.json`. The second command opens the game. Without the file `commits.json`, the game plays with fake commits.

## Make the game for another repository

1. Write the file of commits for your repository: `pnpm experiment:parallax_dino_runner:commits --git-folder /path/to/your/repository`
2. Build the static folder: `pnpm --filter parallax_dino_runner build`
3. Copy the folder `packages/experiments/parallax_dino_runner/dist` to your server, or to the branch of your GitHub Pages.

The folder `dist` holds `index.html`, one script, and `commits.json`. Every address is relative, so the folder works in any place. A browser blocks a page that you open as a file, so use a server of static files, or the command `pnpm --filter parallax_dino_runner exec vite preview`.

## Keys

- Space: jump
- Arrow up and arrow down: change lane
- F: shoot
- P: pause, and continue
- Enter: start, or play again
- M: sound on and off. The game starts with the sound off.
