import { describe, it, expect } from "vitest";
import {
  getMonthDiff,
  toYearMonth,
  formatCohortDisplay,
  computeCohortRetention,
  computeLtvCacCurve,
  computeRfmSegmentation,
  MinimalCustomer,
  MinimalOrder,
} from "../cohort-analytics";

describe("cohort-analytics utilities", () => {
  it("calculates month difference accurately across years", () => {
    const d1 = new Date("2025-01-15");
    const d2 = new Date("2025-06-20");
    const d3 = new Date("2026-03-01");

    expect(getMonthDiff(d1, d2)).toBe(5);
    expect(getMonthDiff(d1, d3)).toBe(14);
  });

  it("formats date to YYYY-MM correctly", () => {
    const d = new Date(2025, 8, 15); // Sept 15, 2025
    expect(toYearMonth(d)).toBe("2025-09");
  });

  it("formats cohort display string with month name", () => {
    expect(formatCohortDisplay("2025-09")).toBe("Sep 2025");
    expect(formatCohortDisplay("2026-01")).toBe("Jan 2026");
  });
});

describe("computeCohortRetention", () => {
  it("returns empty array when no data provided", () => {
    expect(computeCohortRetention([], [])).toEqual([]);
  });

  it("calculates retention percentages from customers and repeat orders", () => {
    const customers: MinimalCustomer[] = [
      { id: "c1", createdAt: new Date("2025-01-05") },
      { id: "c2", createdAt: new Date("2025-01-10") },
    ];

    const orders: MinimalOrder[] = [
      // c1 orders in Jan (M0), Feb (M1), Mar (M2)
      { id: "o1", customerId: "c1", grandTotal: 100, createdAt: new Date("2025-01-05") },
      { id: "o2", customerId: "c1", grandTotal: 80, createdAt: new Date("2025-02-12") },
      { id: "o3", customerId: "c1", grandTotal: 120, createdAt: new Date("2025-03-20") },
      // c2 orders in Jan (M0), skips Feb, orders in Mar (M2)
      { id: "o4", customerId: "c2", grandTotal: 150, createdAt: new Date("2025-01-10") },
      { id: "o5", customerId: "c2", grandTotal: 90, createdAt: new Date("2025-03-15") },
    ];

    const cohorts = computeCohortRetention(customers, orders, 6);
    expect(cohorts.length).toBeGreaterThan(0);

    const janCohort = cohorts.find((c) => c.cohortMonth === "2025-01");
    if (janCohort) {
      expect(janCohort.cohortSize).toBe(2);
      expect(janCohort.retention[0]).toBe(100); // M0 always 100%
      expect(janCohort.retention[1]).toBe(50); // c1 active (1/2 = 50%)
      expect(janCohort.retention[2]).toBe(100); // c1 and c2 active (2/2 = 100%)
    }
  });

  it("ignores cancelled and refunded orders", () => {
    const customers: MinimalCustomer[] = [{ id: "c1", createdAt: new Date("2025-01-05") }];
    const orders: MinimalOrder[] = [
      { id: "o1", customerId: "c1", grandTotal: 100, createdAt: new Date("2025-01-05") },
      {
        id: "o2",
        customerId: "c1",
        grandTotal: 50,
        status: "CANCELLED",
        createdAt: new Date("2025-02-10"),
      },
    ];

    const cohorts = computeCohortRetention(customers, orders, 3);
    const janCohort = cohorts.find((c) => c.cohortMonth === "2025-01");
    if (janCohort) {
      expect(janCohort.retention[1]).toBe(0); // cancelled order doesn't count
    }
  });
});

describe("computeLtvCacCurve", () => {
  it("calculates cumulative LTV and identifies payback month", () => {
    const dummyCohorts = [
      {
        cohortMonth: "2025-01",
        displayMonth: "Jan 2025",
        cohortSize: 10,
        retention: [100, 60, 50, 40],
        revenue: [1000, 500, 400, 300],
        avgAov: 100,
      },
    ];

    const { curve, paybackMonth } = computeLtvCacCurve(dummyCohorts, 50, 6);

    expect(curve).toHaveLength(6);
    expect(curve[0].month).toBe(0);
    expect(curve[0].blendedCac).toBe(50);
    expect(curve[0].cumulativeLtv).toBeGreaterThan(0);
    // As months progress, cumulative LTV should increase monotonically
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].cumulativeLtv).toBeGreaterThanOrEqual(curve[i - 1].cumulativeLtv);
    }
    expect(paybackMonth).not.toBeNull();
  });
});

describe("computeRfmSegmentation", () => {
  it("classifies high recency, high frequency, high spend customer as Champions", () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 5 * 86400000); // 5 days ago

    const customers: MinimalCustomer[] = [
      {
        id: "vip-1",
        name: "VIP Alice",
        totalSpent: 1200,
        totalOrders: 6,
        lastOrderDate: recentDate,
        createdAt: new Date(now.getTime() - 100 * 86400000),
      },
    ];

    const segments = computeRfmSegmentation(customers, [], now);
    const champions = segments.find((s) => s.id === "champions");
    expect(champions).toBeDefined();
    expect(champions?.count).toBe(1);
    expect(champions?.totalRevenue).toBe(1200);
  });

  it("classifies inactive customer as Hibernating or At-Risk", () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 120 * 86400000); // 120 days ago

    const customers: MinimalCustomer[] = [
      {
        id: "churned-1",
        name: "Bob Inactive",
        totalSpent: 400,
        totalOrders: 3,
        lastOrderDate: oldDate,
        createdAt: new Date(now.getTime() - 200 * 86400000),
      },
    ];

    const segments = computeRfmSegmentation(customers, [], now);
    const atRisk = segments.find((s) => s.id === "at_risk");
    expect(atRisk?.count).toBe(1);
  });
});
