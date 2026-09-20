"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { MailWarning, X, Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Dismissible banner shown at the top of the dashboard when the current user's
 * email has not been verified. Fully localized (emailVerification namespace)
 * with two CTAs: "Send code" fires a fresh OTP, "Verify now" routes to the
 * Security Center's inline code entry. Dismissal is persisted in sessionStorage
 * so it only lasts the current tab.
 */
export default function EmailVerificationBanner() {
  const { user, isLoading } = useAuth();
  const t = useTranslations("emailVerification");
  const pathname = usePathname();
  const locale = useLocale();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  // Reset dismissal on route change
  useEffect(() => {
    setDismissed(false);
  }, [pathname]);

  // Check sessionStorage for dismissal
  useEffect(() => {
    try {
      if (sessionStorage.getItem("email-verify-banner-dismissed") === "1") {
        setDismissed(true);
      }
    } catch {
      // Ignore
    }
  }, []);

  if (isLoading || !user || user.emailVerified || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("email-verify-banner-dismissed", "1");
    } catch {
      // Ignore
    }
  };

  const handleSendVerification = async (e: React.MouseEvent) => {
    e.preventDefault(); // Don't navigate
    e.stopPropagation();
    setSending(true);
    try {
      const res = await fetch("/api/auth/verify-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, from: "security" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t("sentToast"));
      } else {
        toast.error(data.error || t("sendFailed"));
      }
    } catch {
      toast.error(t("sendFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cn(
        "mx-3 sm:mx-4 lg:mx-6 mb-4 flex flex-col gap-3 rounded-xl border px-4 py-3",
        "sm:flex-row sm:items-center",
        "bg-amber-50 border-amber-200 text-amber-800",
        "dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-200",
      )}
      data-testid="email-verification-banner"
    >
      <div className="flex min-w-0 items-start gap-3">
        <MailWarning className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{t("title")}</p>
          <p className="text-xs text-amber-700 dark:text-amber-300/70 mt-0.5">{t("description")}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 min-[380px]:flex-nowrap">
        <button
          onClick={handleSendVerification}
          disabled={sending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {sending ? t("sending") : t("sendCode")}
        </button>
        <Link
          href={`/${locale}/security`}
          className={cn(
            "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            "border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300",
            "hover:bg-amber-100 dark:hover:bg-amber-900/40",
          )}
        >
          {t("verifyNow")}
        </Link>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 transition-colors"
          aria-label={t("dismiss")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
