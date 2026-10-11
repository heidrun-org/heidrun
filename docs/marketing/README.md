# Marketing rules for Heidrun

These rules apply to the public website (`packages/auxiliary/website_public`), to the README, to release notes, and to every text that presents Heidrun to the public.

## The title, the motto, and the description

Heidrun has three identity texts: the title, the motto, and the description. They are written once, in the file `data/identity.json`, and nowhere else by hand.

- The application and the website get the three texts from this file. The files `README.md`, `AGENTS.md`, `docs/release_notes/prefix.md`, and `README copy.md` receive them between the markers `<!-- identity:start -->` and `<!-- identity:end -->`. To change a text, change the file, then run `pnpm docs:identity` to update these four files. A test fails when one of them is out of date.
- Write the motto exactly as in the file, with the capital letters of "THE GOAT" and the exclamation mark.
- The motto appears in the splash screen, in the About window, in the hero of the homepage of the website, and in the README.
- The description says what Heidrun does, in one short sentence. The jokes stay in the motto and in the other texts.
- "GOAT" has two meanings, and both are intended: the Greatest Of All Time, and the goat Heiðrún of the Norse mythology.

## The origin of the name

Heiðrún is a goat in Norse mythology. She stands on top of Valhalla and eats the leaves of the tree Læraðr. Mead flows from her udders, and the mead fills a vessel every day. The mead is enough for all the einherjar, the warriors who died in battle. The sources are the *Poetic Edda* and the *Prose Edda*. The full description is on [Wikipedia](https://en.wikipedia.org/wiki/Hei%C3%B0r%C3%BAn).

- Explain this origin on the page About of the website (`packages/auxiliary/website_public/docs/about.md`).
- Every statement about the mythology must be true to these sources. Do not invent mythology.

## The jokes

Keep making jokes about the mythology in every public text: Vikings, Valhalla, mead, the einherjar, Ragnarök, and "Skål!".

- Mapping used on the website: the agents are the einherjar, the work window is Valhalla, the developer is the goat, and a merge conflict is Ragnarök.
- Jokes are short, friendly, and never at the expense of the reader or of another person.
- A joke never replaces an explanation. Every page first says clearly what Heidrun does, then makes the joke.
- The documentation pages for the user (steps, shortcuts, settings) stay plain. Put at most one light joke at the end of a page.

## The splash image

- The splash image is `data/images/heidrun_splash_screen.png`. It shows the goat Heiðrún on top of Valhalla, pouring mead into a cauldron.
- The website uses a copy of the image in `packages/auxiliary/website_public/docs/public/`.
- Use the splash image on the homepage of the website, below the hero, so the motto stays on one line and Heidrun stays in the center.

## The key images

Three images carry the identity of Heidrun in every communication. They all live in `data/images`.

- `data/images/heidrun_icon.png` is the icon of the application, a goat head on an orange square. It is a link to `packages/apps/desktop_tauri/icons/icon.png`, so the icon of the application and the icon used for communication are always the same file.
- `data/images/baby_goat.png` is the baby goat with the golden horns, on a transparent background. The application shows it on the screen of a tab without a pane.
- `data/images/heidrun_splash_screen.png` is the splash image, described above.

## The name

- Write the name of the application as "Heidrun", without the special letters.
- Write the name of the goat as "Heiðrún", with the special letters, when the text is about the mythology.
