import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import QuotaSummary from "./QuotaSummary.vue";
import { advanceWorking, perHour, quotaPace, quotaRingWindow, workingSeconds } from "../lib/format";
import type { QuotaBlock } from "../lib/types";

const claude: QuotaBlock = {
  provider: "claude",
  label: "Claude",
  windows: [
    { id: "session", name: "5 h session", percent: 25, resetsAt: 2000 },
    { id: "week", name: "Week", percent: 60, resetsAt: 3000 },
  ],
  cost: 1.5,
};

describe("QuotaSummary", () => {
  it("shows the name and the percentage of the week in the status bar", () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    expect(wrapper.get(".label").text()).toBe("Claude");
    expect(wrapper.get(".percent").text()).toBe("60%");
  });

  it("shows neither the subscription nor the name of the account in the popover, because the item already shows the name", async () => {
    const quota: QuotaBlock = { provider: "codex", label: "Codex · prolite", windows: [{ id: "week", name: "Week", percent: 44 }] };
    const wrapper = mount(QuotaSummary, { props: { quota } });
    await wrapper.trigger("click");
    expect(wrapper.get(".label").text()).toBe("Codex");
    expect(wrapper.get(".popover").text()).toContain("Week");
    expect(wrapper.get(".popover").text()).not.toContain("Codex");
    expect(wrapper.get(".popover").text()).not.toContain("prolite");
    expect(wrapper.get(".popover").text()).not.toContain("Plan");
  });

  it("opens the popover with a click on the item, and closes it with the next click", async () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    expect(wrapper.find(".popover").exists()).toBe(false);
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("does not open the popover when the mouse pointer only moves over the item", async () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    await wrapper.trigger("mouseenter");
    await wrapper.trigger("mouseover");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("keeps the popover open when the user clicks inside it", async () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    await wrapper.trigger("click");
    await wrapper.get(".popover").trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
  });

  it("opens the popover with the keys Enter and Space when the item has the keyboard focus", async () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    await wrapper.trigger("keydown", { key: "Enter" });
    expect(wrapper.find(".popover").exists()).toBe(true);
    await wrapper.trigger("keydown", { key: " " });
    expect(wrapper.find(".popover").exists()).toBe(false);
    await wrapper.trigger("keydown", { key: " " });
    expect(wrapper.find(".popover").exists()).toBe(true);
  });

  it("closes the popover with the key Escape", async () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude }, attachTo: document.body });
    await wrapper.trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(false);
    wrapper.unmount();
  });

  it("closes the popover when the user presses the mouse outside the item", async () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude }, attachTo: document.body });
    await wrapper.trigger("click");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".popover").exists()).toBe(false);
    wrapper.unmount();
  });

  it("closes the popover when the keyboard focus leaves the item", async () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    await wrapper.trigger("click");
    await wrapper.trigger("focusout");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("fills the ring in proportion to the percentage", () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    const arc = wrapper.get(".arc");
    const length = Number(arc.attributes("stroke-dasharray"));
    expect(Number(arc.attributes("stroke-dashoffset"))).toBeCloseTo(length * 0.4);
  });

  it("lists every window and the cost in the popover", async () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    await wrapper.trigger("click");
    expect(wrapper.findAll("[data-field=window]")).toHaveLength(2);
    expect(wrapper.get(".popover").text()).toContain("Week");
    expect(wrapper.get(".popover").text()).toContain("60 %");
  });

  it("draws the usage of each window with a Bootstrap progress bar, in the color of its level", async () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    await wrapper.trigger("click");
    const barList = wrapper.findAll(".progress-bar");
    expect(barList.map((bar) => bar.attributes("style"))).toEqual(["width: 25%;", "width: 60%;"]);
    expect(barList.map((bar) => bar.classes().filter((name) => name.startsWith("bg-")))).toEqual([["bg-success"], ["bg-warning"]]);
    expect(wrapper.findAll(".progress").map((progress) => progress.attributes("aria-valuenow"))).toEqual(["25", "60"]);
  });

  it("shows the first window in the ring when there is no week", () => {
    const week = { id: "week" as const, name: "Week", percent: 44 };
    expect(quotaRingWindow([week])).toBe(week);
    const wrapper = mount(QuotaSummary, { props: { quota: { provider: "codex", label: "Codex · prolite", windows: [week] } } });
    expect(wrapper.get(".percent").text()).toBe("44%");
  });
});

describe("quotaPace", () => {
  const DAY = 86400;
  const now = 10 * DAY;
  const week = (percent: number, elapsedDays: number) => ({
    id: "week" as const,
    name: "Week",
    percent,
    resetsAt: now + (7 - elapsedDays) * DAY,
  });

  it("is calm below 90 % of the allowed speed", () => {
    const pace = quotaPace(week(30, 3), now)!;
    expect(pace.level).toBe("ok");
    expect(pace.pacePercent).toBeCloseTo(70);
    expect(pace.runsOutAt).toBeUndefined();
  });

  it("warns from 90 % to 100 %", () => {
    expect(quotaPace(week(40, 3), now)!.level).toBe("warn");
  });

  it("is critical above 100 %, with the run-out time and the reduction", () => {
    const pace = quotaPace(week(60, 3), now)!;
    expect(pace.level).toBe("crit");
    expect(pace.pacePercent).toBeCloseTo(140);
    expect(pace.runsOutAt).toBeCloseTo(now + 2 * DAY);
    expect(pace.reducePercent).toBeCloseTo(28.57, 1);
    expect(pace.currentPerHour).toBeCloseTo(60 / 72);
    expect(pace.allowedPerHour).toBeCloseTo(40 / 96);
  });

  it("returns null without a reset time, after the reset, or at the start of the window", () => {
    expect(quotaPace({ id: "week", name: "Week", percent: 10 }, now)).toBeNull();
    expect(quotaPace({ id: "week", name: "Week", percent: 10, resetsAt: now - 1 }, now)).toBeNull();
    expect(quotaPace(week(1, 0.1), now)).toBeNull();
  });

  it("works on the 5 h session", () => {
    const pace = quotaPace({ id: "session", name: "5 h session", percent: 50, resetsAt: now + 150 * 60 }, now)!;
    expect(pace.elapsedPercent).toBeCloseTo(50);
    expect(pace.level).toBe("warn");
  });
});

describe("QuotaSummary pace", () => {
  it("shows the pace as a Bootstrap alert, and the expected-usage mark on the progress bar, in the popover", async () => {
    const nowSeconds = Date.now() / 1000;
    const quota: QuotaBlock = {
      provider: "claude",
      label: "Claude",
      windows: [{ id: "session", name: "5 h session", percent: 90, resetsAt: nowSeconds + 150 * 60 }],
    };
    const wrapper = mount(QuotaSummary, { props: { quota } });
    await wrapper.trigger("click");
    expect(wrapper.get("[data-field=pace]").classes()).toEqual(["alert", "alert-danger"]);
    expect(wrapper.find(".progress [data-field=expected-usage]").exists()).toBe(true);
  });
});

describe("perHour", () => {
  it("keeps one decimal below 10 and none above", () => {
    expect(perHour(0.833)).toBe("0.8");
    expect(perHour(24.6)).toBe("25");
  });
});

describe("working days", () => {
  const HOUR = 3600;
  const DAY = 24 * HOUR;
  const at = (day: number, hour = 0) => new Date(2026, 9, day, hour).getTime() / 1000;
  const MONDAY = 5;
  const weekFrom = (percent: number, nowSeconds: number) => ({
    now: nowSeconds,
    window: { id: "week" as const, name: "Week", percent, resetsAt: at(MONDAY + 7) },
  });

  it("counts only the seconds of the working days", () => {
    expect(workingSeconds(at(MONDAY), at(MONDAY + 7), [1, 2, 3, 4, 5])).toBe(5 * DAY);
    expect(workingSeconds(at(MONDAY), at(MONDAY + 7), [0, 1, 2, 3, 4, 5, 6])).toBe(7 * DAY);
  });

  it("computes the pace on working time only", () => {
    const { window, now } = weekFrom(30, at(MONDAY + 3));
    expect(quotaPace(window, now)!.pacePercent).toBeCloseTo(70);
    const weekdays = quotaPace(window, now, [1, 2, 3, 4, 5])!;
    expect(weekdays.elapsedPercent).toBeCloseTo(60);
    expect(weekdays.pacePercent).toBeCloseTo(50);
  });

  it("skips the days off when it computes the run-out time", () => {
    const { window, now } = weekFrom(40, at(MONDAY, 12));
    const pace = quotaPace(window, now, [1, 5])!;
    expect(pace.level).toBe("crit");
    expect(pace.runsOutAt).toBeCloseTo(at(MONDAY + 4, 6));
  });

  it("returns null from advanceWorking when the moment is after the limit", () => {
    expect(advanceWorking(at(MONDAY), 3 * DAY, [1], at(MONDAY + 7))).toBeNull();
  });

  it("does not use the working days for the 5 h session", () => {
    const now = at(MONDAY, 10);
    const window = { id: "session" as const, name: "5 h", percent: 50, resetsAt: now + 150 * 60 };
    expect(quotaPace(window, now, [3])!.elapsedPercent).toBeCloseTo(50);
  });
});
