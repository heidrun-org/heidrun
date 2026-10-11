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

/** Loads a fresh copy of the module, so that the next bleat to play is the first bleat again. */
async function loadGoatSounds() {
  vi.resetModules();
  return import("./goat_sounds");
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
