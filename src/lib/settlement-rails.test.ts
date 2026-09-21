import { describe, expect, it } from "vitest";

import {
  bankCounterQuotes,
  bestSettlementRail,
  rankSettlementRails,
  SETTLEMENT_RAILS,
  type SettlementRail,
} from "./settlement-rails";

/**
 * Settlement rails — what a converted price actually costs.
 *
 * The point of the module is that the mid-market rate is NOT what you pay, and
 * the recommendation must never be the mid-market reference (it is a yardstick,
 * not something a buyer can transact at). Both of those are pinned here.
 */
const MID = 15_000;
const AMOUNT = 29;

describe("settlement rails", () => {
  it("prices rails against the mid-market total", () => {
    const ranked = rankSettlementRails(AMOUNT, MID);
    const mid = ranked.find((r) => r.id === "midMarket")!;

    expect(mid.localCost).toBe(AMOUNT * MID);
    expect(mid.extraLocal).toBe(0);
    expect(mid.extraPct).toBe(0);
    // The reference is never the recommendation.
    expect(mid.cheapest).toBe(false);
  });

  it("orders cheapest-first and marks exactly one real winner", () => {
    const ranked = rankSettlementRails(AMOUNT, MID);

    const costs = ranked.map((r) => r.localCost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));

    expect(ranked.filter((r) => r.cheapest)).toHaveLength(1);
    const winner = ranked.find((r) => r.cheapest)!;
    expect(winner.kind).toBe("rail");
    // The transfer rail is the cheapest modelled cost over mid-market.
    expect(winner.id).toBe("transfer");
  });

  it("charges more the further a rail sits from mid-market", () => {
    const ranked = rankSettlementRails(AMOUNT, MID);
    const byId = Object.fromEntries(ranked.map((r) => [r.id, r]));

    expect(byId.transfer.localCost).toBeLessThan(byId.ewallet.localCost);
    expect(byId.ewallet.localCost).toBeLessThan(byId.bankWire.localCost);
    expect(byId.bankWire.localCost).toBeLessThan(byId.cardOct.localCost);
    // Each rail is worse than mid, and reports how much worse.
    for (const id of ["transfer", "ewallet", "bankWire", "cardOct"]) {
      expect(byId[id].extraLocal, id).toBeGreaterThan(0);
      expect(byId[id].extraPct, id).toBeGreaterThan(0);
    }
  });

  it("passes flat fees through in local currency", () => {
    const withFee: SettlementRail[] = [{ ...SETTLEMENT_RAILS[1], flatFeeUsd: 5, spreadPct: 0 }];
    const [rail] = rankSettlementRails(AMOUNT, MID, withFee);
    expect(rail.localCost).toBe((AMOUNT + 5) * MID);
    expect(rail.extraLocal).toBe(5 * MID);
  });

  it("recommends the cheaper rail for a small amount too", () => {
    // Flat fees would change this ranking if any rail had one; the model must
    // stay honest about scale rather than hardcoding a winner.
    const best = bestSettlementRail(9, MID);
    expect(best?.id).toBe("transfer");
    const custom: SettlementRail[] = [
      { id: "midMarket", kind: "reference", spreadPct: 0, flatFeeUsd: 0, basis: "publishedSpread" },
      { id: "cardOct", kind: "rail", spreadPct: 0.001, flatFeeUsd: 0, basis: "estimated" },
      { id: "transfer", kind: "rail", spreadPct: 0.02, flatFeeUsd: 0, basis: "publicFee" },
    ];
    expect(bestSettlementRail(9, MID, custom)?.id).toBe("cardOct");
  });

  it("refuses to rank an unpriceable amount", () => {
    expect(rankSettlementRails(0, MID)).toEqual([]);
    expect(rankSettlementRails(-5, MID)).toEqual([]);
    expect(rankSettlementRails(AMOUNT, 0)).toEqual([]);
    expect(bestSettlementRail(Number.NaN, MID)).toBeNull();
  });
});

describe("bank counter rates", () => {
  it("quotes kurs jual above mid and kurs beli below it", () => {
    const [bank] = bankCounterQuotes(AMOUNT, MID);

    expect(bank.kursJual).toBeGreaterThan(MID);
    expect(bank.kursBeli).toBeLessThan(MID);
    // Buying dollars costs more than the mid-market number, by the spread.
    expect(bank.localCost).toBeCloseTo(AMOUNT * bank.kursJual, 6);
    expect(bank.extraPct).toBeGreaterThan(0);
  });

  it("sorts banks by what the buyer actually parts with", () => {
    const banks = bankCounterQuotes(AMOUNT, MID);
    expect(banks).toHaveLength(4);
    const costs = banks.map((b) => b.localCost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    // The cheapest counter is cheaper than the modelled generic bank-wire rail
    // only if its published spread is smaller — assert the relationship, not a
    // fixed bank name.
    expect(banks[0].extraPct).toBeLessThanOrEqual(banks[3].extraPct);
  });

  it("returns nothing for an amount that cannot be priced", () => {
    expect(bankCounterQuotes(0, MID)).toEqual([]);
    expect(bankCounterQuotes(AMOUNT, Number.NaN)).toEqual([]);
  });
});
