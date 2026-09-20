"use client";

import { useCallback, useEffect, useState } from "react";
import {
  daysSinceMfaVerification,
  isMfaVerificationEventType,
  MFA_VERIFIED_RECENT_DAYS,
} from "@/lib/security-score";

export interface SessionRow {
  id: string;
  ip: string | null;
  browser: string | null;
  device: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
  current: boolean;
  /** Both device profile and IP seen on an earlier session of this user. */
  recognized?: boolean;
}

export interface SecurityEventRow {
  id: string;
  type: string;
  ip: string | null;
  createdAt: string;
  /** Structured payload (rate-limit counters, endpoint, blocked flag…). */
  metadata?: {
    endpoint?: string;
    attempt?: number;
    limit?: number;
    blocked?: boolean;
    email?: string;
    [key: string]: unknown;
  } | null;
}

export interface PasskeyRow {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface TrustedDeviceRow {
  id: string;
  label: string | null;
  device: string;
  browser: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface SecurityData {
  sessions: SessionRow[];
  events: SecurityEventRow[];
  backupRemaining: number | null;
  passkeys: PasskeyRow[];
  trustedDevices: TrustedDeviceRow[];
  /** null while loading / unknown */
  totpEnabled: boolean | null;
  /** ISO timestamp when the email was verified, or null. */
  emailVerified: string | null;
  /** Whether an MFA method was verified within the last 30 days. */
  mfaVerifiedRecently: boolean;
  /**
   * ISO timestamp of the newest MFA-verification event (TOTP, passkey login,
   * backup code) visible in the fetched window — null when none exists.
   * Backs the visible days-since counter for the 30-day policy.
   */
  mfaLastVerifiedAt: string | null;
  /** Whole days since that verification (null = never verified). */
  mfaDaysSince: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/** Compact relative-time label: "42s", "12m", "5h", "3d". */
export function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Whether an ISO timestamp falls within the last `days` days. */
export function withinDays(date: string, days: number): boolean {
  return Date.now() - new Date(date).getTime() < days * 24 * 60 * 60 * 1000;
}

const json = <T>(res: Response, fallback: T): Promise<T> =>
  res.ok ? (res.json() as Promise<T>) : Promise.resolve(fallback);

/**
 * Single source of truth for account-security data. Fetches active sessions,
 * security events, backup-code count, passkeys, and 2FA status in parallel and
 * exposes a `refresh()` used after every mutation.
 */
export function useSecurityData(): SecurityData {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [backupRemaining, setBackupRemaining] = useState<number | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceRow[]>([]);
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [emailVerified, setEmailVerified] = useState<string | null>(null);
  const [mfaVerifiedRecently, setMfaVerifiedRecently] = useState(false);
  const [mfaLastVerifiedAt, setMfaLastVerifiedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [s, e, b, p, pr, td] = await Promise.allSettled([
      fetch("/api/auth/sessions").then((r) => json<SessionRow[]>(r, [])),
      // 30 events (not 20) so the telemetry panel has enough RATE_LIMITED /
      // ACCOUNT_LOCKED rows to summarize even on busy accounts.
      // take=60: wide enough that seeded demo telemetry (RATE_LIMITED /
      // ACCOUNT_LOCKED) stays visible alongside normal sign-in traffic.
      fetch("/api/auth/security-events?take=60").then((r) => json<SecurityEventRow[]>(r, [])),
      fetch("/api/auth/backup-codes")
        .then((r) => json<{ remaining: number }>(r, { remaining: 0 }))
        .then((d) => d.remaining ?? 0),
      fetch("/api/auth/webauthn/credentials").then((r) => json<PasskeyRow[]>(r, [])),
      fetch("/api/profile").then((r) =>
        json<{ totpEnabled?: boolean; emailVerified?: string | null }>(r, {}),
      ),
      fetch("/api/auth/trusted-devices").then((r) => json<TrustedDeviceRow[]>(r, [])),
    ]);
    if (s.status === "fulfilled" && Array.isArray(s.value)) setSessions(s.value);
    if (e.status === "fulfilled" && Array.isArray(e.value)) {
      setEvents(e.value);
      // MFA verification is rewarded if a real second-factor proof happened
      // within the recency window (TOTP, passkey login, or backup code).
      // Events arrive newest-first, so the first hit is the newest proof —
      // the same timestamp the visible days-since counter renders.
      const newestProof = e.value.find((ev) => isMfaVerificationEventType(ev.type));
      setMfaLastVerifiedAt(newestProof ? newestProof.createdAt : null);
      setMfaVerifiedRecently(
        e.value.some(
          (ev) =>
            isMfaVerificationEventType(ev.type) &&
            withinDays(ev.createdAt, MFA_VERIFIED_RECENT_DAYS),
        ),
      );
    }
    if (b.status === "fulfilled" && typeof b.value === "number") setBackupRemaining(b.value);
    if (p.status === "fulfilled" && Array.isArray(p.value)) setPasskeys(p.value);
    if (td.status === "fulfilled" && Array.isArray(td.value)) setTrustedDevices(td.value);
    if (pr.status === "fulfilled" && typeof pr.value?.totpEnabled === "boolean") {
      setTotpEnabled(pr.value.totpEnabled);
    }
    if (pr.status === "fulfilled" && typeof pr.value?.emailVerified === "string") {
      setEmailVerified(pr.value.emailVerified);
    } else if (pr.status === "fulfilled") {
      setEmailVerified(null);
    }
  }, []);

  useEffect(() => {
    // Refresh only sets state after awaited fetches resolve; the disable is
    // the same pattern used by the dashboard layout's route-change effect.
    refresh().finally(() => setLoading(false)); // eslint-disable-line react-hooks/set-state-in-effect
  }, [refresh]);

  return {
    sessions,
    events,
    backupRemaining,
    passkeys,
    trustedDevices,
    totpEnabled,
    emailVerified,
    mfaVerifiedRecently,
    mfaLastVerifiedAt,
    // Computed on fetch completion (client-only), never during SSR render.
    mfaDaysSince: daysSinceMfaVerification(mfaLastVerifiedAt),
    loading,
    refresh,
  };
}
