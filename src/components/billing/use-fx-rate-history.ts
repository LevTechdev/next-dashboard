"use client";

import { useEffect, useState } from "react";

import type { FxTrendPoint } from "@/components/billing/fx-trend-sparkline";

/**
 * The recorded daily history for one FX pair, fetched once per mount.
 * The sparkline treats missing days as gaps, so a 404 or a slow endpoint
 * degrades to "no trend yet" rather than a wrong line.
 */
export function useFxRateHistory(quote: string, days = 30) {
  const [points, setPoints] = useState<FxTrendPoint[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/billing/fx-rates?history=1&quote=${encodeURIComponent(quote)}&days=${days}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        return data.history as FxTrendPoint[];
      })
      .then((history) => {
        if (alive) setPoints(history ?? []);
      })
      .catch(() => {
        if (alive) setPoints([]);
      });
    return () => {
      alive = false;
    };
  }, [quote, days]);

  return points;
}
