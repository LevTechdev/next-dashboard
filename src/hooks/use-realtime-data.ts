"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface RealtimeOptions<T = unknown> {
  /** Polling interval in ms (default: 30000) */
  interval?: number;
  /** Enable auto-refresh (default: true) */
  enabled?: boolean;
  /** Called when data changes significantly */
  onUpdate?: (data: T) => void;
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
  const { interval = 30000, enabled = true, onUpdate } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prevDataRef = useRef<string>("");

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
