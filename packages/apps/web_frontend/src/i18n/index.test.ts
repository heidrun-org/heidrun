import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LANGUAGES, hasText, language, locale, t } from "./index";
import { settings } from "../stores/settings";

const LOCALES_DIR = path.join(import.meta.dirname, "locales");

function readNamespace(lang: string, file: string): Record<string, string> {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, lang, file), "utf8"));
}

afterEach(() => {
  settings.language = "en";
});

describe("t", () => {
  it("returns the text of a key", () => {
    expect(t("confirmModal.cancel")).toBe(readNamespace("en", "confirmModal.json").cancel);
  });

  it("returns the key itself when the text is missing", () => {
    expect(t("nothing.here")).toBe("nothing.here");
  });

  it("follows the language setting", () => {
    settings.language = "fr";
    expect(language.value).toBe("fr");
    expect(t("confirmModal.cancel")).toBe(readNamespace("fr", "confirmModal.json").cancel);
  });

  it("falls back to English for an unknown language", () => {
    (settings as { language: string }).language = "de";
    expect(language.value).toBe("en");
  });

  it("selects the locale of the language", () => {
    expect(locale.value).toBe("en-US");
    settings.language = "fr";
    expect(locale.value).toBe("fr-FR");
  });

  it("sets the lang attribute of the page", async () => {
    settings.language = "fr";
    await Promise.resolve();
    expect(document.documentElement.lang).toBe("fr");
  });

  it("replaces the markers with the parameters", () => {
    expect(t("alertsStore.context.title", { name: "Zed", percent: 91 })).toContain("Zed");
    expect(t("alertsStore.context.title", { name: "Zed", percent: 91 })).toContain("91");
  });

  it("keeps a marker without parameter", () => {
    expect(t("alertsStore.context.title", { name: "Zed" })).toContain("{percent}");
  });

  it("chooses the singular and the plural form from the count", () => {
    const one = t("alertsStore.evening.title", { count: 1 });
    const many = t("alertsStore.evening.title", { count: 5 });
    expect(one).not.toBe(many);
    expect(many).toContain("5");
  });
});

describe("hasText", () => {
  it("is true for a key that has a text", () => {
    expect(hasText("confirmModal.cancel")).toBe(true);
  });

  it("is false for a key without a text", () => {
    expect(hasText("nothing.here")).toBe(false);
  });
});

describe("locale files", () => {
  const languages = LANGUAGES.map((l) => l.id);

  it("has a folder for every language", () => {
    for (const lang of languages) {
      expect(fs.existsSync(path.join(LOCALES_DIR, lang))).toBe(true);
    }
  });

  it("has the same namespaces in every language", () => {
    const lists = languages.map((lang) => fs.readdirSync(path.join(LOCALES_DIR, lang)).sort());
    for (const list of lists) {
      expect(list).toEqual(lists[0]);
    }
  });

  it("has the same keys in every language", () => {
    const files = fs.readdirSync(path.join(LOCALES_DIR, "en"));
    for (const file of files) {
      const reference = Object.keys(readNamespace("en", file)).sort();
      for (const lang of languages) {
        expect(Object.keys(readNamespace(lang, file)).sort(), `${lang}/${file}`).toEqual(reference);
      }
    }
  });

  it("uses the same markers in every language", () => {
    const markers = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    const files = fs.readdirSync(path.join(LOCALES_DIR, "en"));
    for (const file of files) {
      const en = readNamespace("en", file);
      const fr = readNamespace("fr", file);
      for (const key of Object.keys(en)) {
        if (key.endsWith("_one")) {
          // A singular form may write "one" in words instead of the {count} marker.
          for (const marker of markers(fr[key])) {
            expect(markers(en[key]), `${file}:${key}`).toContain(marker);
          }
          continue;
        }
        expect(markers(fr[key]), `${file}:${key}`).toEqual(markers(en[key]));
      }
    }
  });

  it("has no empty text", () => {
    for (const lang of languages) {
      for (const file of fs.readdirSync(path.join(LOCALES_DIR, lang))) {
        for (const [key, text] of Object.entries(readNamespace(lang, file))) {
          expect(text.length, `${lang}/${file}:${key}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
