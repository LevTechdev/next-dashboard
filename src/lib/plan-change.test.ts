import { describe, expect, it } from "vitest";
import {
  classifyChange,
  nextPeriodEndFrom,
  previewPlanChange,
  rateFor,
  roundMoney,
  type ProrationPlan,
} from "./plan-change";

const starter: ProrationPlan = {
  id: "p-starter",
  name: "Starter",
  price: 29,
  yearlyPrice: 276,
  sortOrder: 0,
};
const pro: ProrationPlan = {
  id: "p-pro",
  name: "Professional",
  price: 79,
  yearlyPrice: 756,
  sortOrder: 1,
};
const enterprise: ProrationPlan = {
  id: "p-ent",
  name: "Enterprise",
  price: 199,
  yearlyPrice: 1908,
  sortOrder: 2,
};

/** A month-long period with exactly half of it left. */
const periodStart = new Date("2026-09-01T00:00:00Z");
const periodEnd = new Date("2026-10-01T00:00:00Z");
const halfway = new Date("2026-09-16T00:00:00Z"); // 15 of 30 days used

describe("rateFor", () => {
  it("uses the yearly rate for YEARLY when the plan has one", () => {
    expect(rateFor(pro, "YEARLY")).toBe(756);
    expect(rateFor(pro, "MONTHLY")).toBe(79);
  });

  it("falls back to the monthly rate when no yearly price is configured", () => {
    const noYearly: ProrationPlan = {
      id: "p",
      name: "X",
      price: 10,
      yearlyPrice: null,
      sortOrder: 0,
    };
    expect(rateFor(noYearly, "YEARLY")).toBe(10);
  });
});

describe("classifyChange", () => {
  it("names tier moves by sort order", () => {
    expect(classifyChange(starter, pro, "MONTHLY", "MONTHLY")).toBe("UPGRADE");
    expect(classifyChange(enterprise, pro, "MONTHLY", "MONTHLY")).toBe("DOWNGRADE");
  });

  it("treats a same-tier interval change as a period switch", () => {
    expect(classifyChange(pro, pro, "MONTHLY", "YEARLY")).toBe("PERIOD_SWITCH");
  });

  it("reports NONE for an identical target", () => {
    expect(classifyChange(pro, pro, "MONTHLY", "MONTHLY")).toBe("NONE");
  });

  it("reports LATERAL for equal-ranked distinct plans", () => {
    const sibling: ProrationPlan = { id: "p-other", name: "Other", price: 79, sortOrder: 1 };
    expect(classifyChange(pro, sibling, "MONTHLY", "MONTHLY")).toBe("LATERAL");
  });
});

describe("previewPlanChange", () => {
  const base = {
    currentPlan: starter,
    nextPlan: pro,
    currentInterval: "MONTHLY" as const,
    nextInterval: "MONTHLY" as const,
    periodStart,
    periodEnd,
    now: halfway,
  };

  it("credits unused time on the old rate and charges the same span on the new one", () => {
    const preview = previewPlanChange(base);
    // Half the month left: $14.50 of Starter credited, $39.50 of Professional charged.
    expect(preview.remainingFraction).toBeCloseTo(0.5, 5);
    expect(preview.credit).toBe(14.5);
    expect(preview.charge).toBe(39.5);
    expect(preview.dueToday).toBe(25);
    expect(preview.kind).toBe("UPGRADE");
  });

  it("never refunds: a downgrade lands at or below zero due today", () => {
    const preview = previewPlanChange({
      ...base,
      currentPlan: enterprise,
      nextPlan: starter,
    });
    expect(preview.kind).toBe("DOWNGRADE");
    expect(preview.credit).toBe(99.5);
    expect(preview.charge).toBe(14.5);
    expect(preview.dueToday).toBe(-85);
  });

  it("prices a monthly → yearly switch against the yearly rate", () => {
    const preview = previewPlanChange({
      ...base,
      currentPlan: pro,
      nextPlan: pro,
      currentInterval: "MONTHLY",
      nextInterval: "YEARLY",
    });
    expect(preview.kind).toBe("PERIOD_SWITCH");
    expect(preview.credit).toBe(39.5); // half of $79
    expect(preview.charge).toBe(378); // half of $756
    expect(preview.dueToday).toBe(338.5);
    expect(preview.nextPeriodEnd.getFullYear()).toBe(2027);
  });

  it("charges nothing extra when the period is already over", () => {
    const preview = previewPlanChange({ ...base, now: new Date("2026-10-02T00:00:00Z") });
    expect(preview.remainingFraction).toBe(0);
    expect(preview.credit).toBe(0);
    expect(preview.charge).toBe(0);
    expect(preview.dueToday).toBe(0);
  });

  it("is a no-op for an identical target", () => {
    const preview = previewPlanChange({ ...base, nextPlan: starter, nextInterval: "MONTHLY" });
    expect(preview.kind).toBe("NONE");
    expect(preview.changeable).toBe(false);
    expect(preview.dueToday).toBe(0);
  });

  it("rounds to cents once, so preview and invoice cannot disagree", () => {
    // 1/3 of a $29 month = $9.666… → $9.67, and the same for the next rate.
    const third = new Date(
      periodStart.getTime() + (periodEnd.getTime() - periodStart.getTime()) / 3,
    );
    const preview = previewPlanChange({ ...base, now: third });
    expect(preview.credit).toBe(roundMoney(29 * (2 / 3)));
    expect(preview.credit).toBe(19.33);
    expect(preview.dueToday).toBe(roundMoney(preview.charge - preview.credit));
  });
});

describe("nextPeriodEndFrom", () => {
  it("adds a month or a year", () => {
    const now = new Date("2026-09-16T12:00:00Z");
    expect(nextPeriodEndFrom(now, "MONTHLY").toISOString()).toContain("2026-10-16");
    expect(nextPeriodEndFrom(now, "YEARLY").getFullYear()).toBe(2027);
  });
});
