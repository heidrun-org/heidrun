import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn(async () => "granted"),
  sendNotification: vi.fn(),
}));

import { sendNotification } from "@tauri-apps/plugin-notification";
import { isQuiet, notify } from "./notify";
import { settings } from "../stores/settings";

const at = (hours: number, minutes = 0) => new Date(2026, 0, 15, hours, minutes);

afterEach(() => {
  settings.quietFrom = "";
  settings.quietTo = "";
  vi.clearAllMocks();
});

describe("isQuiet", () => {
  it("is never quiet without hours", () => {
    expect(isQuiet(at(3))).toBe(false);
  });

  it("is quiet inside a same-day period", () => {
    settings.quietFrom = "12:00";
    settings.quietTo = "14:00";
    expect(isQuiet(at(13))).toBe(true);
    expect(isQuiet(at(14))).toBe(false);
    expect(isQuiet(at(11, 59))).toBe(false);
  });

  it("is quiet inside a period that spans midnight", () => {
    settings.quietFrom = "20:00";
    settings.quietTo = "08:00";
    expect(isQuiet(at(23))).toBe(true);
    expect(isQuiet(at(2))).toBe(true);
    expect(isQuiet(at(8))).toBe(false);
    expect(isQuiet(at(12))).toBe(false);
    expect(isQuiet(at(20))).toBe(true);
  });

  it("is not quiet when both hours are equal", () => {
    settings.quietFrom = "10:00";
    settings.quietTo = "10:00";
    expect(isQuiet(at(10))).toBe(false);
  });

  it("ignores a badly written hour", () => {
    settings.quietFrom = "late";
    settings.quietTo = "08:00";
    expect(isQuiet(at(2))).toBe(false);
  });
});

describe("notify", () => {
  it("sends a notification outside the quiet hours", async () => {
    expect(await notify("Title", "Body")).toBe(true);
    expect(sendNotification).toHaveBeenCalledWith({ title: "Title", body: "Body" });
  });

  it("sends nothing during the quiet hours", async () => {
    const now = new Date();
    settings.quietFrom = `${String(now.getHours()).padStart(2, "0")}:00`;
    settings.quietTo = `${String((now.getHours() + 1) % 24).padStart(2, "0")}:00`;
    expect(await notify("Title")).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
