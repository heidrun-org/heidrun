import Fs from "node:fs";
import Path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SOUNDS_FOLDER = Path.join(import.meta.dirname, "../../../../../data/sounds/goat_bleat");

/** A fake audio element that records what the code does to it. */
class FakeAudio {
  static instances: FakeAudio[] = [];
  static playResult: () => Promise<void> = async () => {};
  currentTime = 99;
  play = vi.fn(() => FakeAudio.playResult());
  pause = vi.fn();
  constructor(public src: string) {
    FakeAudio.instances.push(this);
  }
}

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/**
 * Loads a fresh copy of the module and of the settings, so that the next bleat to play is the first bleat again. The
 * setting "goat sound" is on, except when `isGoatSoundOn` is false.
 */
async function loadGoatSounds(isGoatSoundOn = true) {
  localStorage.clear();
  vi.resetModules();
  const { settings } = await import("../stores/settings");
  settings.goatSound = isGoatSoundOn;
  const goatSounds = await import("./goat_sounds");
  return { ...goatSounds, settings };
}

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.playResult = async () => {};
  vi.stubGlobal("Audio", FakeAudio);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("playNextGoatBleat", () => {
  it("plays the first bleat, then the second bleat, then the first bleat again, in turn", async () => {
    const { playNextGoatBleat } = await loadGoatSounds();
    playNextGoatBleat();
    playNextGoatBleat();
    playNextGoatBleat();
    expect(FakeAudio.instances).toHaveLength(2);
    const [firstBleat, secondBleat] = FakeAudio.instances;
    expect(firstBleat.src).toContain("goat_bleat_1.wav");
    expect(secondBleat.src).toContain("goat_bleat_2.wav");
    expect(firstBleat.play).toHaveBeenCalledTimes(2);
    expect(secondBleat.play).toHaveBeenCalledTimes(1);
  });

  it("rewinds a bleat to its start before it plays", async () => {
    const { playNextGoatBleat } = await loadGoatSounds();
    playNextGoatBleat();
    expect(FakeAudio.instances[0].currentTime).toBe(0);
  });

  it("stops the bleat that is still playing when the next bleat starts", async () => {
    const { playNextGoatBleat } = await loadGoatSounds();
    playNextGoatBleat();
    playNextGoatBleat();
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledTimes(1);
    expect(FakeAudio.instances[1].play).toHaveBeenCalledTimes(1);
    expect(FakeAudio.instances[0].pause.mock.invocationCallOrder[0]).toBeLessThan(
      FakeAudio.instances[1].play.mock.invocationCallOrder[0],
    );
  });

  it("does not fail when the browser refuses to play the sound", async () => {
    FakeAudio.playResult = async () => {
      throw new Error("play refused");
    };
    const { playNextGoatBleat } = await loadGoatSounds();
    expect(() => playNextGoatBleat()).not.toThrow();
    await Promise.resolve();
  });

  it("does not fail when the browser has no audio element", async () => {
    vi.stubGlobal(
      "Audio",
      class {
        constructor() {
          throw new Error("no audio");
        }
      },
    );
    const { playNextGoatBleat } = await loadGoatSounds();
    expect(() => playNextGoatBleat()).not.toThrow();
  });
});

describe("the setting goat sound", () => {
  it("plays nothing when it is off, and it is off in a new installation", async () => {
    localStorage.clear();
    vi.resetModules();
    const { settings } = await import("../stores/settings");
    const { playNextGoatBleat } = await import("./goat_sounds");
    expect(settings.goatSound).toBe(false);
    playNextGoatBleat();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("plays nothing when it is off, and creates no audio element", async () => {
    const { playNextGoatBleat } = await loadGoatSounds(false);
    playNextGoatBleat();
    playNextGoatBleat();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("does not move the turn of the bleats when it is off: the first bleat plays when it goes on", async () => {
    const { playNextGoatBleat, settings } = await loadGoatSounds(false);
    playNextGoatBleat();
    playNextGoatBleat();
    settings.goatSound = true;
    playNextGoatBleat();
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toContain("goat_bleat_1.wav");
  });

  it("plays no sound by itself when it goes on", async () => {
    const { settings } = await loadGoatSounds(false);
    settings.goatSound = true;
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("applies at once, with no wait: a bleat plays after it goes on and stays silent after it goes off", async () => {
    const { playNextGoatBleat, settings } = await loadGoatSounds(false);
    playNextGoatBleat();
    settings.goatSound = true;
    playNextGoatBleat();
    settings.goatSound = false;
    playNextGoatBleat();
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].play).toHaveBeenCalledTimes(1);
  });

  it("stops the bleat that is playing at the moment when it goes off", async () => {
    const { playNextGoatBleat, settings } = await loadGoatSounds();
    playNextGoatBleat();
    playNextGoatBleat();
    for (const audioElement of FakeAudio.instances) {
      audioElement.pause.mockClear();
    }
    settings.goatSound = false;
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledTimes(1);
    expect(FakeAudio.instances[1].pause).toHaveBeenCalledTimes(1);
  });

  it("does not stop a bleat when it goes on", async () => {
    const { playNextGoatBleat, settings } = await loadGoatSounds(false);
    settings.goatSound = true;
    playNextGoatBleat();
    FakeAudio.instances[0].pause.mockClear();
    settings.goatSound = true;
    expect(FakeAudio.instances[0].pause).not.toHaveBeenCalled();
  });

  it("does not fail when it goes off and the browser cannot pause a sound", async () => {
    const { playNextGoatBleat, settings } = await loadGoatSounds();
    playNextGoatBleat();
    FakeAudio.instances[0].pause.mockImplementation(() => {
      throw new Error("pause refused");
    });
    expect(() => {
      settings.goatSound = false;
    }).not.toThrow();
  });
});

describe("the sound files of the goat bleats", () => {
  for (const fileName of ["goat_bleat_1.wav", "goat_bleat_2.wav"]) {
    it(`keeps ${fileName} in the folder data/sounds/goat_bleat, as a small wave file of about 2.5 seconds`, () => {
      const content = Fs.readFileSync(Path.join(SOUNDS_FOLDER, fileName));
      expect(content.toString("ascii", 0, 4)).toBe("RIFF");
      expect(content.toString("ascii", 8, 12)).toBe("WAVE");
      expect(content.length).toBeLessThan(1_000_000);
      const bytesPerSecond = content.readUInt32LE(28);
      const durationSeconds = (content.length - 44) / bytesPerSecond;
      expect(durationSeconds).toBeGreaterThan(2);
      expect(durationSeconds).toBeLessThan(3);
    });
  }

  it("gives the Freesound page and the author of the sound, for the credit", async () => {
    const { GOAT_SOUND_AUTHOR, GOAT_SOUND_SOURCE_URL } = await loadGoatSounds();
    expect(GOAT_SOUND_AUTHOR).toBe("sonsdebarcelona");
    expect(GOAT_SOUND_SOURCE_URL).toBe("https://freesound.org/people/sonsdebarcelona/sounds/393948/");
  });
});
