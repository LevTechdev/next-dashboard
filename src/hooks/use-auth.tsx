"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  installAuthFetch,
  refreshAccessToken,
  prewarmCsrfToken,
  forceLoginRedirect,
} from "@/lib/client-refresh";

/** Subscription tier payload from /api/auth/me (see src/lib/plan-tiers.ts). */
export interface TierFeaturesClient {
  tier: "REGULAR" | "PRO" | "ENTERPRISE";
  planName: string;
  maxOrders: number | null;
  maxTeamMembers: number | null;
  hasAnalytics: boolean;
  hasReports: boolean;
  hasMultiChannel: boolean;
  hasApiAccess: boolean;
  hasRoleBasedAccess: boolean;
  hasCustomExports: boolean;
  supportLevel: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  position?: string | null;
  avatar?: string | null;
  role: string;
  totpEnabled: boolean;
  emailVerified?: string | null;
  picture?: string;
  tier?: TierFeaturesClient;
}

interface AuthContextType {
  user: User | null;
  /** Subscription tier payload from /api/auth/me (src/lib/plan-tiers.ts). */
  tierFeatures: TierFeaturesClient | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
    totpToken?: string,
    /** Second factor via an emailed OTP instead of the authenticator app. */
    emailOtpCode?: string,
    /** Ask the server to email a login-challenge OTP (method chooser). */
    challengeEmailOtp?: boolean,
    /** Complete the second factor with an already-verified passkey marker. */
    passkeyAsserted?: boolean,
    /** Trust this device for 30 days (skip 2FA on future sign-ins). */
    trustDevice?: boolean,
    /**
     * Recovery path for a lost authenticator: one of the pre-generated
     * single-use backup codes. Consumed server-side on success.
     */
    backupCode?: string,
  ) => Promise<{
    success: boolean;
    requires2FA?: boolean;
    /** Which second factor the server expects / has just emailed. */
    method?: "totp" | "email_otp";
    emailSent?: boolean;
    /** Durably queued for delivery after the response (see lib/email-outbox). */
    emailQueued?: boolean;
    /** True when the server's mail configuration cannot reach real recipients. */
    mailMisconfigured?: boolean;
    /** Dev-mode inline OTP (no mailer configured). */
    devOtp?: string;
    /** Whether the account has registered passkeys (chooser option). */
    hasPasskeys?: boolean;
    /**
     * Unused recovery codes left after a backup-code sign-in (absent on every
     * other path). Drives the "your codes are running out" warning.
     */
    backupCodesRemaining?: number;
    error?: string;
    /**
     * Machine-readable reason when the server has one worth localizing —
     * currently `"TOTP_REPLAY"`, meaning the code was already spent inside its
     * own time step and a new one is needed rather than a retry.
     */
    code?: string;
    attemptsLeft?: number;
  }>;
  register: (
    name: string,
    email: string,
    password: string,
    locale?: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    /** True when an email OTP was issued and must be entered to verify. */
    emailOtpRequired?: boolean;
    /** True when a configured transport accepted the verification email. */
    emailSent?: boolean;
    /** True when it is durably queued (delivery continues after the response). */
    emailQueued?: boolean;
    /** True when the server's mail configuration cannot reach real recipients. */
    mailMisconfigured?: boolean;
    /** Dev-only fallback: the raw 6-digit code (never present in production). */
    devOtp?: string;
  }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  tierFeatures: null,
  isLoading: true,
  error: null,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
  updateUser: () => {},
});

/**
 * Welcome-back copy resolves from the same static locale bundles the
 * provider tree uses (src/lib/locale-messages.ts) — no React context needed.
 */

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tierFeatures, setTierFeatures] = useState<TierFeaturesClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    // Ensure the 401→refresh→retry fetch wrapper is active before the first call.
    installAuthFetch();
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setTierFeatures((data as { tier?: TierFeaturesClient }).tier ?? null);
        setError(null);
        return;
      }
    } catch {
      // Ignore fetch errors
    }
    // Not authenticated or error
    setUser(null);
    setTierFeatures(null);
  }, []);

  // Check auth status on mount
  useEffect(() => {
    // Pre-warm the CSRF token alongside the first /me fetch so the first
    // mutation never waits for the /api/auth/csrf round-trip.
    prewarmCsrfToken();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  // Cross-tab freshness: when any tab/window regains focus or the document
  // becomes visible again, silently re-fetch /api/auth/me so plan upgrades
  // (e.g. completed in another tab during checkout) flip tier features
  // everywhere instantly — no re-login, no stale feature gates. Throttled to
  // at most one revalidation per 30s to keep the endpoint quiet.
  //
  // Identity-drift guard: if the session now belongs to a DIFFERENT user than
  // the one this tab was opened with (another tab logged in, or an account
  // switch happened elsewhere), we do NOT silently adopt the new identity —
  // that was the "dashboard automatically switches to another user's account"
  // bug. The tab clears its state and reloads so every surface (JWT cookie,
  // React state, SSE stream) re-syncs to exactly one identity.
  const lastRevalidateRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const revalidate = async () => {
      const now = Date.now();
      if (now - lastRevalidateRef.current < 30_000) return;
      lastRevalidateRef.current = now;
      const res = await fetch("/api/auth/me");
      if (!res.ok) return; // leave state untouched; 401 handling lives elsewhere
      const data = await res.json();
      if (data?.id && currentUserIdRef.current && data.id !== currentUserIdRef.current) {
        // Session identity changed under this tab — hard reset to a coherent
        // state instead of silently rendering another user's workspace. The
        // shared helper navigates with the tab's own locale and is
        // loop-guarded, so the followed account switch always ends on the
        // login form rather than in a mixed-identity shell.
        setUser(null);
        setTierFeatures(null);
        forceLoginRedirect("session-changed");
        return;
      }
      setUser(data);
      setTierFeatures((data as { tier?: TierFeaturesClient }).tier ?? null);
      setError(null);
    };
    const onFocus = () => void revalidate();
    const onVisible = () => {
      if (document.visibilityState === "visible") void revalidate();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  // Proactively rotate the short-lived access token while authenticated so it
  // stays fresh (well under its 15m lifetime) and 401s stay rare.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(
      () => {
        refreshAccessToken();
      },
      12 * 60 * 1000,
    );
    return () => clearInterval(id);
  }, [user]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      totpToken?: string,
      emailOtpCode?: string,
      challengeEmailOtp?: boolean,
      passkeyAsserted?: boolean,
      trustDevice?: boolean,
      backupCode?: string,
    ) => {
      setError(null);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            totpToken,
            emailOtpCode,
            challengeEmailOtp,
            passkeyAsserted,
            trustDevice,
            backupCode,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          return {
            success: false,
            error: data.error || "Login failed",
            code: data.code,
            attemptsLeft: data.attemptsLeft,
          };
        }

        if (data.requires2FA) {
          return {
            success: false,
            requires2FA: true,
            method: data.method,
            emailSent: data.emailSent,
            devOtp: data.devOtp,
            /** Whether the account has registered passkeys (chooser option). */
            hasPasskeys: data.hasPasskeys,
          };
        }

        if (data.user) {
          setUser(data.user);
          // The login payload doesn't carry the tier — fetch /me for the
          // full profile + subscription so tier-gated surfaces resolve now.
          void refreshUser();
          // Fresh login → normal session-alert rhythm (clear any prior
          // "Stay signed in" extension from the previous session).
          try {
            window.localStorage.removeItem("session_stay_signed_in");
          } catch {
            /* ignore */
          }
          // Returning users (account older than 48h) never see the guided
          // onboarding — the tour and checklist are suppressed for them and a
          // one-time welcome-back toast replaces them. New accounts keep the
          // full onboarding experience.
          try {
            const u = data.user as { id?: string; createdAt?: string };
            const ageMs = u.createdAt ? Date.now() - new Date(u.createdAt).getTime() : 0;
            if (u.id && ageMs > 48 * 60 * 60 * 1000) {
              localStorage.setItem(`onboarding-tour-done:${u.id}`, "true");
              localStorage.setItem(`onboarding-dismissed:${u.id}`, "true");
              const wbKey = `welcome-back-shown:${u.id}`;
              const last = localStorage.getItem(wbKey);
              const today = new Date().toDateString();
              if (last !== today) {
                localStorage.setItem(wbKey, today);
                // Static locale bundles ship with the app shell anyway (see
                // providers.tsx), so importing them here adds no weight and
                // keeps the toast localized without a React context.
                const { LOCALE_MESSAGES } = await import("@/lib/locale-messages");
                const loc = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]*)/)?.[1] || "en";
                const dash = LOCALE_MESSAGES[loc]?.dashboard ?? LOCALE_MESSAGES.en.dashboard;
                const { toast } = await import("sonner");
                toast.success(dash.welcomeBackTitle, {
                  description: dash.welcomeBackDesc.replace(
                    "{when}",
                    new Date(u.createdAt!).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    }),
                  ),
                });
              }
            }
          } catch {
            /* storage unavailable — onboarding behaves normally */
          }
        }

        router.refresh();
        return { success: true, backupCodesRemaining: data.backupCodesRemaining };
      } catch {
        return { success: false, error: "Network error. Please try again." };
      }
    },
    [router, refreshUser],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, locale?: string) => {
      setError(null);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, locale }),
        });

        const data = await res.json();

        if (!res.ok) {
          return { success: false, error: data.error || "Registration failed" };
        }

        if (data.user) {
          setUser(data.user);
        }

        router.refresh();
        return {
          success: true,
          emailOtpRequired: data.emailOtpRequired === true,
          emailSent: data.emailSent === true,
          devOtp: typeof data.devOtp === "string" ? data.devOtp : undefined,
        };
      } catch {
        return { success: false, error: "Network error. Please try again." };
      }
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors
    }
    // Reset the session-stay sentinel so the next login starts with the
    // normal alert rhythm (the "Stay signed in" extension is per-login).
    try {
      window.localStorage.removeItem("session_stay_signed_in");
    } catch {
      /* ignore */
    }
    setUser(null);
    setTierFeatures(null);
    router.push("/en/login");
    router.refresh();
  }, [router]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        tierFeatures,
        isLoading,
        error,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
