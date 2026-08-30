"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeOptions<T = unknown> {
  /** Polling interval in ms (default: 30000) */
  interval?: number;
  /** Enable auto-refresh (default: true) */
  enabled?: boolean;
  /** Called when data changes significantly */
  onUpdate?: (data: T) => void;
  /** Supabase Realtime: subscribe to Postgres Changes on a table for instant updates. */
  realtime?: {
    /** Database table name (e.g. "orders") */
    table: string;
    /** Event filter — default "*" (all changes) */
    event?: "INSERT" | "UPDATE" | "DELETE" | "*";
    /** Schema — default "public" */
    schema?: string;
  };
}

interface RealtimeState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

export function useRealtimeData<T = unknown>(
  url: string,
  options: RealtimeOptions<T> = {},
): RealtimeState<T> {
  const { interval = 30000, enabled = true, onUpdate, realtime } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prevDataRef = useRef<string>("");
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // no-store guarantees the table reflects the latest mutations (avoids the
      // browser serving a stale cached GET after a create/update/delete).
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      // Detect significant changes for notification
      const resultStr = JSON.stringify(result);
      if (prevDataRef.current && resultStr !== prevDataRef.current && onUpdate) {
        onUpdate(result);
      }
      prevDataRef.current = resultStr;

      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [url, onUpdate]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
  }, [fetchData]);

  // Supabase Realtime subscription — triggers immediate refresh on table changes
  useEffect(() => {
    if (!enabled || !realtime?.table) return;

    let cancelled = false;

    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        if (cancelled) return;
        const supabase = createClient();

        const ch = supabase
          .channel(`rt:${realtime.table}`)
          .on(
            "postgres_changes",
            {
              event: realtime.event ?? "*",
              schema: realtime.schema ?? "public",
              table: realtime.table,
            },
            () => {
              // Instant refresh when a row changes — no need to wait for poll
              if (!cancelled) refresh();
            },
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" && !cancelled) {
              console.error(`[realtime] Channel error on table "${realtime.table}"`);
            }
          });

        channelRef.current = ch;
      } catch {
        // Supabase client not configured — fall back to polling only
      }
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        // Best-effort cleanup
        import("@/lib/supabase/client")
          .then(({ createClient }) => {
            const supabase = createClient();
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
            }
          })
          .catch(() => {});
        channelRef.current = null;
      }
    };
  }, [enabled, realtime?.table, realtime?.event, realtime?.schema, refresh]);

  // Polling — always active as a fallback (e.g. when Supabase Realtime is unavailable)
  useEffect(() => {
    if (!enabled) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const intervalId = setInterval(fetchData, interval);

    return () => clearInterval(intervalId);
  }, [fetchData, interval, enabled]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    isRefreshing,
    refresh,
  };
}
