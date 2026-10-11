import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

describe("the theme", () => {
  it("is written in data-theme for the application, and in data-bs-theme for Bootstrap", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {} }));
    const { settings } = await import("./settings");
    await import("./theme");

    settings.theme = "light";
    await nextTick();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.bsTheme).toBe("light");

    settings.theme = "dark";
    await nextTick();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.bsTheme).toBe("dark");
  });
});
