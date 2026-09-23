"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

/**
 * Verification success toasts, app-wide.
 *
 * Flows that complete with a full-page redirect (email-verification confirm
 * link) or that may complete on any dashboard page (2FA enable, password
 * change) land here: when the URL carries a `verified=`/`verification=`
 * success marker, a celebratory green toast is shown once and the marker is
 * stripped from the address bar — so a refresh or share never replays it.
 *
 * Markers:
 * - ?verified=true / ?verification=success → email verified
 * - ?verified=invalid / ?verification=expired → failure variant (error toast)
 * - ?2fa=enabled / ?password=changed → same treatment for security actions
 *   completed on redirects.
 */
export function VerificationSuccessToaster() {
  const pathname = usePathname();
  const router = useRouter();
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

    let consumed = false;

    const consume = (keys: string[]) => {
      let changed = false;
      for (const k of keys) {
        if (params.has(k)) {
          params.delete(k);
          changed = true;
        }
      }
      if (changed) {
        consumed = true;
        const qs = params.toString();
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
      }
    };

    // Email verification (confirm link: security center + profile variants)
    if (params.get("verified") === "true" || params.get("verification") === "success") {
      fire("emailVerified", "success");
    } else if (params.get("verified") === "invalid") {
      fire("emailVerifyFailed", "error");
    }
    consume(["verified", "verification"]);

    // 2FA enable/disable completed via redirect
    if (params.get("2fa") === "enabled") fire("twoFactorEnabled", "success");
    if (params.get("2fa") === "disabled") fire("twoFactorDisabled", "success");
    consume(["2fa"]);

    // Password change completed via redirect
    if (params.get("password") === "changed") fire("passwordChanged", "success");
    consume(["password"]);

    void consumed;
  }, [pathname, router, t]);

  return null;
}

/** Helper for flows that want to signal success through the URL. */
export function verificationSuccessUrl(path: string, kind: "email" | "2fa" | "password"): string {
  const sep = path.includes("?") ? "&" : "?";
  const marker =
    kind === "email" ? "verification=success" : kind === "2fa" ? "2fa=enabled" : "password=changed";
  return `${path}${sep}${marker}`;
}
