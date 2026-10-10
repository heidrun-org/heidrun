import { beforeEach, describe, expect, it } from "vitest";
import { LegacyStorage } from "./legacy_storage";

describe("LegacyStorage.migrate", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("copies a former key to the new name and removes the former key", () => {
    localStorage.setItem("herdr-desk.settings", "{\"a\":1}");
    LegacyStorage.migrate();
    expect(localStorage.getItem("heidrun.settings")).toBe("{\"a\":1}");
    expect(localStorage.getItem("herdr-desk.settings")).toBeNull();
  });

  it("does not overwrite a key that already exists under the new name", () => {
    localStorage.setItem("herdr-desk.notes", "old");
    localStorage.setItem("heidrun.notes", "new");
    LegacyStorage.migrate();
    expect(localStorage.getItem("heidrun.notes")).toBe("new");
    expect(localStorage.getItem("herdr-desk.notes")).toBeNull();
  });

  it("leaves other keys alone", () => {
    localStorage.setItem("other.key", "x");
    LegacyStorage.migrate();
    expect(localStorage.getItem("other.key")).toBe("x");
  });

  it("migrates several keys at once", () => {
    localStorage.setItem("herdr-desk.a", "1");
    localStorage.setItem("herdr-desk.b", "2");
    LegacyStorage.migrate();
    expect(localStorage.getItem("heidrun.a")).toBe("1");
    expect(localStorage.getItem("heidrun.b")).toBe("2");
    expect(localStorage.length).toBe(2);
  });

  it("does nothing when the storage is empty", () => {
    expect(() => LegacyStorage.migrate()).not.toThrow();
    expect(localStorage.length).toBe(0);
  });
});
