/**
 * Self-serve plan changes: classification + proration.
 *
 * Pure functions — no Prisma, no clock of their own (callers pass `now`) — so
 * the arithmetic that decides what a customer is charged can be unit-tested
 * exactly, and the pricing-page confirmation dialog can preview it before
 * anything is written.
 *
 * Money model (kept deliberately simple and never refunding):
 *
 *   · A change closes the CURRENT period early.
 *   · Unused time on the old rate is credited pro-rata:
 *       credit = oldRate × remainingFraction
 *   · The new rate is charged for the SAME remaining span, so nothing is
 *     billed twice and nothing is gifted:
 *       charge = newRate × remainingFraction
 *   · dueToday = charge − credit. Negative means a credit note (applied to the
 *     next invoice by the gateway); the local path records no charge at all.
 *
 * Every change is immediate — there is no pending/scheduled state to reconcile
 * with a scheduler, and a downgrade is exactly as cheap as its arithmetic says
 * (usually $0 today). Amounts are rounded to cents HERE, once, so the preview,
 * the invoice row, and the audit line cannot disagree.
 */

export type BillingInterval = "MONTHLY" | "YEARLY";

export type PlanChangeKind = "UPGRADE" | "DOWNGRADE" | "LATERAL" | "PERIOD_SWITCH" | "NONE";

/** The slice of a Plan this engine needs. */
export interface ProrationPlan {
  id: string;
  name: string;
  price: number;
  yearlyPrice?: number | null;
  /** Tier ordering — the only thing that decides up vs. down. */
  sortOrder: number;
}

export interface PlanChangeInput {
  currentPlan: ProrationPlan;
  nextPlan: ProrationPlan;
  currentInterval: BillingInterval;
  nextInterval: BillingInterval;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
}

export interface PlanChangePreview {
  kind: PlanChangeKind;
  /** True when the change can be applied (kind !== "NONE"). */
  changeable: boolean;
  /** The rate the workspace is on today (per interval). */
  currentRate: number;
  /** The rate it would move to. */
  nextRate: number;
  /** Portion of the current period still unused, 0…1. */
  remainingFraction: number;
  /** Pro-rata value of the unused time on the current rate. */
  credit: number;
  /** Pro-rata cost of the new rate for that same span. */
  charge: number;
  /** What is owed today (negative = credit note). */
  dueToday: number;
  /** When the new plan takes effect — always now: changes are immediate. */
  effectiveAt: Date;
  /** When the new period would end at the target interval. */
  nextPeriodEnd: Date;
}

/** The rate a plan charges for an interval; falls back to monthly pricing. */
export function rateFor(plan: ProrationPlan, interval: BillingInterval): number {
  if (interval === "YEARLY") {
    const yearly = plan.yearlyPrice;
    if (yearly != null && yearly > 0) return yearly;
  }
  return plan.price;
}

/** Cents-safe rounding — one place, so preview and invoice always agree. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * What kind of move is this? Tier order decides up/down (the same ordering the
 * pricing page renders), and a change of interval on the SAME tier is its own
 * case because that is what the "switch to yearly" affordance produces.
 */
export function classifyChange(
  currentPlan: ProrationPlan,
  nextPlan: ProrationPlan,
  currentInterval: BillingInterval,
  nextInterval: BillingInterval,
): PlanChangeKind {
  if (currentPlan.id === nextPlan.id) {
    return currentInterval === nextInterval ? "NONE" : "PERIOD_SWITCH";
  }
  if (nextPlan.sortOrder > currentPlan.sortOrder) return "UPGRADE";
  if (nextPlan.sortOrder < currentPlan.sortOrder) return "DOWNGRADE";
  return "LATERAL";
}

/** The period a change starts, at the target interval. */
export function nextPeriodEndFrom(now: Date, interval: BillingInterval): Date {
  const end = new Date(now);
  if (interval === "YEARLY") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

/**
 * Proration preview. `remainingFraction` is the unused share of the current
 * period; when the period is already over (or malformed) the fraction is 0 and
 * the change costs nothing today — the new period simply starts fresh.
 */
export function previewPlanChange(input: PlanChangeInput): PlanChangePreview {
  const { currentPlan, nextPlan, currentInterval, nextInterval, periodStart, periodEnd, now } =
    input;

  const kind = classifyChange(currentPlan, nextPlan, currentInterval, nextInterval);
  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const remainingMs = periodEnd.getTime() - now.getTime();
  const remainingFraction = totalMs > 0 ? clamp01(remainingMs / totalMs) : 0;

  const currentRate = rateFor(currentPlan, currentInterval);
  const nextRate = rateFor(nextPlan, nextInterval);

  const credit = roundMoney(currentRate * remainingFraction);
  const charge = roundMoney(nextRate * remainingFraction);
  // A tier move re-prices the same span; a "NONE" is a no-op with no money in
  // it at all (the UI disables the CTA before it gets here).
  const dueToday = kind === "NONE" ? 0 : roundMoney(charge - credit);

  return {
    kind,
    changeable: kind !== "NONE",
    currentRate,
    nextRate,
    remainingFraction,
    credit,
    charge,
    dueToday,
    effectiveAt: now,
    nextPeriodEnd: nextPeriodEndFrom(now, nextInterval),
  };
}
