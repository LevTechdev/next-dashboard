"use client";

import { useEffect, useRef, useCallback } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type PostgresChangesFilter = {
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  table?: string;
  filter?: string;
};

interface UseSupabaseRealtimeOptions {
  /** The Supabase Realtime channel name. Defaults to `"db-changes"`. */
  channel?: string;
  /** Postgres Changes filter — which table/events to subscribe to. */
  filter: PostgresChangesFilter;
  /** Callback invoked when a matching row changes. */
  onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  /** Whether to enable the subscription. Defaults to `true`. */
  enabled?: boolean;
}

/**
 * Subscribe to Supabase Realtime Postgres Changes with automatic cleanup.
 *
 * @example
 * ```tsx
 * useSupabaseRealtime({
 *   filter: { event: "*", schema: "public", table: "orders" },
 *   onEvent: (payload) => {
 *     console.log("Order changed:", payload.eventType, payload.new);
 *   },
 * });
 * ```
 */
export function useSupabaseRealtime({
  channel = "db-changes",
  filter,
  onEvent,
  enabled = true,
}: UseSupabaseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const subscribe = useCallback(() => {
    const supabase = createClient();

    const ch = supabase
      .channel(channel)
      .on(
        "postgres_changes",
        {
          event: filter.event ?? "*",
          schema: filter.schema ?? "public",
          table: filter.table,
          filter: filter.filter,
        },
        (payload) => onEventRef.current(payload),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error(`[supabase-realtime] Channel "${channel}" error`);
        }
      });

    channelRef.current = ch;
  }, [channel, filter.event, filter.schema, filter.table, filter.filter]);

  useEffect(() => {
    if (!enabled) return;

    subscribe();

    return () => {
      if (channelRef.current) {
        supabaseRemoveChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, subscribe]);
}

/**
 * Manually remove a Supabase channel (for use outside the hook, e.g. in
 * cleanup or error recovery).
 */
async function supabaseRemoveChannel(channel: RealtimeChannel) {
  try {
    const supabase = createClient();
    await supabase.removeChannel(channel);
  } catch {
    // Best-effort cleanup
  }
}
