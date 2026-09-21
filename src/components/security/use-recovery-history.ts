"use client";

import { useCallback, useEffect, useState } from "react";

import {
  READINESS_HISTORY_DAYS,
  type ReadinessLevel,
  type ReadinessTrend,
} from "@/lib/recovery-readiness";

export interface RecoveryHistoryPoint {
  day: string;
  level: ReadinessLevel;
  availableCount: number;
  codesLow: boolean;
}

export interface RecoveryHistoryState {
  points: RecoveryHistoryPoint[];
  trend: ReadinessTrend;
  days: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * The account's recovery-readiness series for the sparkline.
 *
 * The first call sends `capture=1`, which records today's verdict before
 * returning the series — so the graph has a point for today even on an account
 * whose nightly sweep has not run since its last change. The capture is server
 * side and idempotent per UTC day (and the drop alert is deduped), so a page
 * reload cannot fabricate history or double-alert.
 */
export function useRecoveryHistory(days: number = READINESS_HISTORY_DAYS): RecoveryHistoryState {
  const [points, setPoints] = useState<RecoveryHistoryPoint[]>([]);
  const [trend, setTrend] = useState<ReadinessTrend>("flat");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (capture: boolean) => {
      try {
        const res = await fetch(
          `/api/auth/recovery-history?days=${days}${capture ? "&capture=1" : ""}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          snapshots?: RecoveryHistoryPoint[];
          trend?: ReadinessTrend;
        };
        if (Array.isArray(data.snapshots)) setPoints(data.snapshots);
        if (data.trend) setTrend(data.trend);
      } catch {
        // Best-effort: the panel above still tells the truth without history.
      }
    },
    [days],
  );

  useEffect(() => {
    // State is only set after an awaited fetch resolves — same pattern as
    // use-security-data's initial load.
    load(true).finally(() => setLoading(false)); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  return {
    points,
    trend,
    days,
    loading,
    refresh: useCallback(() => load(true), [load]),
  };
}
