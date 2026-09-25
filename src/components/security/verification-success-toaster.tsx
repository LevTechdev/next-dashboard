"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

/**
 * Toasts for flows that complete through a full-page redirect.
 *
 * Ownership split — one toast per marker, by design:
 *
 * - `?verified=true|invalid` is owned by the landing pages themselves
 *   (profile, Security Center — the only targets the confirm route's
 *   `from` whitelist redirects to). The pages strip the marker
 *   synchronously with `history.replaceState` and re-fetch server truth
 *   (the param alone must never flip the verified badge), so a page-local
 *   toast is the single source. This watcher deliberately does not touch
 *   that marker: its previous async `router.replace()` strip left the
 *   marker in the URL across effect re-runs, firing a second (and under
 *   StrictMode a third) duplicate toast for one bad link.
 *
 * - Redirect-only markers with no page-local handler land here. The strip
 *   is synchronous for the same reason: by the time this effect re-runs
 *   (StrictMode double-invoke, provider identity churn), the marker is
 *   already gone from the URL, so it cannot fire twice.
 *
 * Markers:
 * - ?verified=true|invalid → owned by the landing pages (NOT this watcher)
 * - ?verification=success → email verified (helper-emitted, no landing page)
 * - ?2fa=enabled / ?2fa=disabled → 2FA change completed via redirect
 * - ?password=changed → password change completed via redirect
 */
export function VerificationSuccessToaster() {
  const t = useTranslations("verificationSuccess");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    const fire = (key: string, kind: "success" | "error") => {
      const fn = kind === "success" ? toast.success : toast.error;
      fn(t(key), {
        icon: kind === "success" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : undefined,
        duration: 6000,
      });
    };

    // Synchronous URL strip — see doc comment for why this is not router.replace.
    const consume = (keys: string[]) => {
      let changed = false;
      for (const k of keys) {
        if (params.has(k)) {
          params.delete(k);
          changed = true;
        }
      }
      if (changed) {
        const qs = params.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
      }
      return changed;
    };

    // NOTE: ?verified=... is intentionally NOT consumed here — the landing
    // pages (profile, Security Center) own that marker and fire their own
    // page-local toast (see ownership note above).

    // ?verification=success is the helper-emitted variant with no landing
    // page — this watcher is its single owner.
    if (params.get("verification") === "success") fire("emailVerified", "success");
    consume(["verification"]);

    // 2FA enable/disable completed via redirect
    if (params.get("2fa") === "enabled") fire("twoFactorEnabled", "success");
    if (params.get("2fa") === "disabled") fire("twoFactorDisabled", "success");
    consume(["2fa"]);

    // Password change completed via redirect
    if (params.get("password") === "changed") fire("passwordChanged", "success");
    consume(["password"]);
  }, [t]);

  return null;
}

/** Helper for flows that want to signal success through the URL. */
export function verificationSuccessUrl(path: string, kind: "email" | "2fa" | "password"): string {
  const sep = path.includes("?") ? "&" : "?";
  const marker =
    kind === "email" ? "verification=success" : kind === "2fa" ? "2fa=enabled" : "password=changed";
  return `${path}${sep}${marker}`;
}
