# Directory Context: `/packages/experiments/parallax_dino_runner/src/view`

## Purpose
The page of the game: the canvas, the keyboard, the game loop, and the drawing of every picture. It reads the state of `src/game/` and never changes it.

## Key Exports & Entry Points
- `game_page.ts`: `GamePage`, the entry of `index.html`. It runs the rules in fixed steps of one sixtieth of a second, plays the sound of each event, then draws one picture after each frame of the browser.
- `scene_renderer.ts`: `SceneRenderer`, one whole picture, from back to front: the sky, the mountains, the hills, the ground, each lane, the counters, and the messages.
- `backdrop_painter.ts`, `ground_painter.ts`, `thing_painter.ts`, `dinosaur_painter.ts`, `hud_painter.ts`: one class for each part of the picture.
- `keyboard_input.ts`: `KeyboardInput`. Space jumps, Arrow Up and Arrow Down change lane, F shoots, Enter starts the game and starts it again, and M turns the sound off and on.
- `sound_player.ts`: `SoundPlayer`, the sound of each `GameEvent`, built from oscillators and noise with the Web Audio API.
- `lane_layout.ts`: `LaneLayout`, where the three lanes are on the screen, and the size of the part of the design that the window shows.
- `sprite_frames.ts`, `pixel_sprites.ts`: the pixel pictures of the dinosaur and of the cactus, and their drawing.
- `view_palette.ts`: `ViewPalette`, every color.

## Rules
- The code imports from `src/game/` only through `src/index.ts`.
- The code never changes the state, and it holds no rule of the game. Only `GamePage` takes the events with `GameWorld.takeEvents`.
- A position on the screen is in design units. The design is 540 units high, and `SceneRenderer` scales the bottom part of it to the window.
- A thing on a far lane is smaller and higher on the screen, and it moves slower on the screen. `LaneLayout.screenX` gives this for every thing, shot, and piece.
- The speed of each parallax layer comes from `GameSettings`, and `ParallaxRules.layerOffset` gives its place.
- Only `ViewPalette` holds a color of a picture.
- Only `sound_player.ts` uses the Web Audio API. The audio context starts at a key press, because a browser allows no sound before the player acts.

## Background
- The window shows only the bottom 450 units of the design, so the dinosaur and the rocks are big. A narrower part of the world ahead of the dinosaur is visible, and the dinosaur stands near the left edge to keep the reaction time long enough at the highest speed.
