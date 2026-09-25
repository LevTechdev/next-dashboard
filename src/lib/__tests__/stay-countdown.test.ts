import { describe, it, expect } from "vitest";

import { advanceStayCountdown, formatStayClock } from "@/lib/stay-countdown";

/**
 * Pure math behind the visibility-aware stay-login countdown.
 *
 * The bug class this kills: the old sentinel subtracted wall-clock deltas
 * unconditionally, so a tab left in the background (or a laptop asleep) blew
 * through the 10-minute window and auto-signed the user out at 0:00 without
 * the warning card ever having a chance to render. The rule now: hidden time
 * freezes the countdown; visible time consumes it.
 */
describe("advanceStayCountdown", () => {
  it("consumes the delta while visible", () => {
    const { remaining, expired } = advanceStayCountdown(3 * 60_000, 1_000, true);
    expect(remaining).toBe(3 * 60_000 - 1_000);
    expect(expired).toBe(false);
  });

  it("freezes while hidden — the wall delta is NOT consumed", () => {
    const before = 2 * 60_000;
    const { remaining, expired } = advanceStayCountdown(before, 10 * 60_000, false);
    expect(remaining).toBe(before);
    expect(expired).toBe(false);
  });

  it("expires only from visible time", () => {
    const { expired } = advanceStayCountdown(500, 1_000, true);
    expect(expired).toBe(true);
  });

  it("a hidden hour costs nothing; visible seconds still tick", () => {
    let carried = 10 * 60_000;
    // An hour in the background.
    ({ remaining: carried } = advanceStayCountdown(carried, 60 * 60_000, false));
    expect(carried).toBe(10 * 60_000);
    // Ten seconds back in the foreground.
    for (let i = 0; i < 10; i++) {
      ({ remaining: carried } = advanceStayCountdown(carried, 1_000, true));
    }
    expect(carried).toBe(10 * 60_000 - 10_000);
  });
});

describe("formatStayClock", () => {
  it("formats m:ss", () => {
    expect(formatStayClock(2 * 60_000 + 5_000)).toBe("2:05");
  });

  it("clamps negatives to 0:00", () => {
    expect(formatStayClock(-4_000)).toBe("0:00");
  });
});
