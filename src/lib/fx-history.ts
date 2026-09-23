import "server-only";

import { prisma } from "@/lib/db";
import { fetchMidMarketRates } from "@/lib/market-rates";
import { CURRENCIES } from "@/lib/currency";
import type { SupportedCurrencyCode } from "@/lib/currency";

/**
 * FX rates over time.
 *
 * The pricing surface quotes the live mid-market rate, but a rate without a
 * past is just a number: the trend sparkline needs a series, and "the rupiah
 * moved 3% today" needs history to detect. This module records one row per
 * currency pair per UTC day — mirroring the recovery-readiness design: a pure
 * judgement helper, an idempotent daily capture, and a deduped alert — and
 * speaks up when a pair moves sharply.
 *
 * The judgement here is deliberately tiny (percent move between two rows), so
 * unlike recovery-readiness there is no separate pure module; the threshold is
 * exported for tests and future UI affordances.
 */

/** A day-over-day move beyond this percent raises the alert. */
export const FX_MOVE_ALERT_PCT = 2;

/** UTC calendar day key — the series is a day-per-row, so the key is a label. */
function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Quote currencies tracked: every supported currency except the USD base. */
export function trackedQuotes(): SupportedCurrencyCode[] {
  return (Object.keys(CURRENCIES) as SupportedCurrencyCode[]).filter((code) => code !== "USD");
}

/**
 * Record today's rate for every tracked pair from one `getRates` call — a
 * second capture the same day UPDATES the row rather than appending noise.
 * The move is judged against the most recent earlier row (yesterday or older,
 * whichever exists), so a first observation never invents a move.
 */
export async function captureFxSnapshot(opts?: { notify?: boolean }): Promise<{
  day: string;
  source: string;
  captured: { quote: string; rate: number; movePct: number | null; alerted: boolean }[];
}> {
  const quote = await fetchMidMarketRates();
  const day = utcDay();
  const results: { quote: string; rate: number; movePct: number | null; alerted: boolean }[] = [];

  for (const code of trackedQuotes()) {
    const rate = quote.rates[code];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) continue;

    // Most recent earlier row for this pair — the comparison anchor.
    const prev = await prisma.fxRateSnapshot.findFirst({
      where: { base: "USD", quote: code, day: { lt: day } },
      orderBy: { day: "desc" },
      select: { rate: true },
    });

    const movePct = prev ? Math.abs((rate - Number(prev.rate)) / Number(prev.rate)) * 100 : null;

    await prisma.fxRateSnapshot.upsert({
      where: { base_quote_day: { base: "USD", quote: code, day } },
      create: {
        base: "USD",
        quote: code,
        day,
        rate,
        source: quote.source,
        prevRate: prev?.rate ?? null,
        movePct,
      },
      update: {
        rate,
        source: quote.source,
        prevRate: prev?.rate ?? null,
        movePct,
      },
    });

    let alerted = false;
    if (movePct !== null && movePct >= FX_MOVE_ALERT_PCT && opts?.notify !== false) {
      alerted = await alertOnFxMove(code, Number(prev!.rate), rate, movePct);
    }

    results.push({ quote: code, rate, movePct, alerted });
  }

  return { day, source: quote.source, captured: results };
}

/**
 * Write the "{quote} moved sharply today" in-app alert. Deduped to one per
 * day per currency — the capture is idempotent but the panel, the scheduler
 * and an explicit refresh could all observe the same move within a day, and
 * three identical alerts read as a bug. Best-effort: a failed alert never
 * fails the capture.
 */
async function alertOnFxMove(
  quote: string,
  prevRate: number,
  rate: number,
  movePct: number,
): Promise<boolean> {
  const direction = rate > prevRate ? "weakened" : "strengthened";
  const title = `${quote} moved sharply against the dollar`;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const already = await prisma.notification.findFirst({
      // Notifications are per-user; there is no "system user", so fan out to
      // every active user with the same dedupe discipline as recovery drift.
      // (Small user base today; the scheduler runs once a day.)
      where: { title, createdAt: { gte: since } },
      select: { id: true, userId: true },
    });

    const description =
      `The mid-market rate moved ${movePct.toFixed(2)}% today — the dollar ` +
      `${direction} against ${quote}: 1 USD went from ${formatRate(quote, prevRate)} ` +
      `to ${formatRate(quote, rate)}. Prices shown in ${quote} follow the market.`;

    if (!already) {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: "alert",
          title,
          description,
          link: "/pricing",
        })),
      });
    }

    return !already;
  } catch (err) {
    console.error("[fx-history] alert failed:", err);
    return false;
  }
}

/** Display rounding: IDR/CNY/JPY get whole units, the rest four decimals. */
function formatRate(quote: string, rate: number): string {
  const zeroDecimals = new Set(["IDR", "JPY", "CNY"]);
  return rate.toLocaleString("en-US", {
    maximumFractionDigits: zeroDecimals.has(quote) ? 0 : 4,
  });
}

export interface FxHistoryRow {
  day: string;
  rate: number;
  source: string;
  movePct: number | null;
}

/** The last `days` days of a pair's rates, oldest first, gaps omitted. */
export async function fxRateHistory(
  quote: string,
  days: number,
  base = "USD",
): Promise<FxHistoryRow[]> {
  const since = utcDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  const rows = await prisma.fxRateSnapshot.findMany({
    where: { base, quote, day: { gte: since } },
    orderBy: { day: "asc" },
    select: { day: true, rate: true, source: true, movePct: true },
  });
  return rows.map((r) => ({
    day: r.day,
    rate: Number(r.rate),
    source: r.source,
    movePct: r.movePct,
  }));
}
