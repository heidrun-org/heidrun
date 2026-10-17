import { watch } from "vue";
import { settings } from "../stores/settings";
import firstBleatUrl from "../../../../../data/sounds/goat_bleat/goat_bleat_1.wav";
import secondBleatUrl from "../../../../../data/sounds/goat_bleat/goat_bleat_2.wav";

/** The Freesound page of the sound "Cabra", where the two goat bleats come from. */
export const GOAT_SOUND_SOURCE_URL = "https://freesound.org/people/sonsdebarcelona/sounds/393948/";

/** The author of the sound "Cabra" on Freesound. The license of the sound asks for a credit to the author. */
export const GOAT_SOUND_AUTHOR = "sonsdebarcelona";

/** The two goat bleats, in the order that they play. They are the two halves of the sound "Cabra". */
const BLEAT_URLS = [firstBleatUrl, secondBleatUrl];

/** One audio element for each bleat, created at the first play of the bleat. */
const audioElements: (HTMLAudioElement | undefined)[] = [];

/** The place in `BLEAT_URLS` of the bleat that the next call of `playNextGoatBleat` plays. */
let nextBleatIndex = 0;

/**
 * Plays the next goat bleat, and then the other bleat at the following call, in turn. A bleat that is still playing
 * stops, so two clicks in a row never play two bleats at the same time. When the setting "goat sound" is off, nothing
 * plays, and the turn of the bleats does not move (issue #620). A sound is a convenience: a failure to play it never
 * breaks the interface.
 */
export function playNextGoatBleat(): void {
  if (settings.goatSound === false) {
    return;
  }
  const index = nextBleatIndex;
  nextBleatIndex = (nextBleatIndex + 1) % BLEAT_URLS.length;
  try {
    stopGoatBleats();
    const audioElement = (audioElements[index] ??= new Audio(BLEAT_URLS[index]));
    audioElement.currentTime = 0;
    void Promise.resolve(audioElement.play()).catch(() => {});
  } catch {
    // The sound is a convenience: a browser that cannot play it stays silent.
  }
}

/** Stops every goat bleat that is playing. */
function stopGoatBleats(): void {
  for (const audioElement of audioElements) {
    audioElement?.pause();
  }
}

// The change is synchronous, so a bleat stops at the moment when the developer switches the setting off.
watch(
  () => settings.goatSound,
  (isOn) => {
    if (isOn === false) {
      try {
        stopGoatBleats();
      } catch {
        // The sound is a convenience: a browser that cannot pause it stays silent.
      }
    }
  },
  { flush: "sync" },
);
