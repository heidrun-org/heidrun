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

  it("hides the subscription in the status bar and shows it on the right of the hover card title", () => {
    const quota: QuotaBlock = { provider: "codex", label: "Codex · prolite", windows: [] };
    const wrapper = mount(QuotaSummary, { props: { quota } });
    expect(wrapper.get(".label").text()).toBe("Codex");
    expect(wrapper.get(".card-title").text()).toBe("Codex");
    expect(wrapper.get(".card-plan-name").text()).toBe("prolite");
  });

  it("fills the ring in proportion to the percentage", () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    const arc = wrapper.get(".arc");
    const length = Number(arc.attributes("stroke-dasharray"));
    expect(Number(arc.attributes("stroke-dashoffset"))).toBeCloseTo(length * 0.4);
  });

  it("lists every window and the cost in the hover card", () => {
    const wrapper = mount(QuotaSummary, { props: { quota: claude } });
    expect(wrapper.findAll(".card-window")).toHaveLength(2);
    expect(wrapper.get(".card").text()).toContain("Week");
    expect(wrapper.get(".card").text()).toContain("60 %");
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
  it("shows the pace box and the expected-usage mark in the hover card", () => {
    const nowSeconds = Date.now() / 1000;
    const quota: QuotaBlock = {
      provider: "claude",
      label: "Claude",
      windows: [{ id: "session", name: "5 h session", percent: 90, resetsAt: nowSeconds + 150 * 60 }],
    };
    const wrapper = mount(QuotaSummary, { props: { quota } });
    expect(wrapper.find(".pace-crit").exists()).toBe(true);
    expect(wrapper.find(".tick").exists()).toBe(true);
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
