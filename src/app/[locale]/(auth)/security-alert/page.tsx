"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ShieldAlert, ShieldCheck, LoaderCircle, ArrowLeft, LockKeyhole } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";

type State = "checking" | "valid" | "invalid" | "securing";

/**
 * Landing page for the "This wasn't me" link in the 2FA-disabled alert email.
 *
 * It exists to separate *reading* the link from *using* it. The email's URL
 * lands here and only peeks at the token; the single use is claimed when the
 * button below is pressed. That matters because mail providers, corporate
 * scanners, and chat clients all fetch — and sometimes execute — links in
 * transit: with a direct one-click GET, a prefetch burned the token, and the
 * account owner was shown "already used" while their account stayed open.
 *
 * It also gives the action a moment of honesty. "Secure my account" signs
 * every device out and demands a new password, which is worth saying before
 * someone triggers it from a mail they half-read.
 */
function SecurityAlertView() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || "en";
  const token = searchParams.get("token") || "";
  const tauth = useTranslations("auth");

  const [state, setState] = useState<State>(token ? "checking" : "invalid");
  const [failedToSend, setFailedToSend] = useState(false);

  // Read-only validation: never claims the link.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/security-alert?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setState(data?.valid ? "valid" : "invalid");
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const secure = useCallback(async () => {
    setState("securing");
    try {
      const res = await fetch("/api/auth/security-alert/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.resetUrl) {
        // The account is locked to a password reset now: land on that form.
        router.push(data.resetUrl);
        return;
      }
      setFailedToSend(true);
      setState("invalid");
    } catch {
      setFailedToSend(true);
      setState("invalid");
    }
  }, [token, locale, router]);

  const busy = state === "checking" || state === "securing";
  const isValid = state === "valid";

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-primary dark:bg-zinc-950 p-4 transition-colors duration-300">
      <div className="relative z-10 flex w-full max-w-[1000px] items-center justify-center gap-8 md:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as never }}
          className="w-full max-w-md shrink-0"
        >
          <div className="mb-8 flex justify-center">
            <BrandLogo animated />
          </div>
          <Card
            data-testid="security-alert-card"
            className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-white/20 dark:border-zinc-800/50 shadow-2xl shadow-black/5 dark:shadow-black/20 overflow-hidden"
          >
            <div
              className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/0 to-primary/0 ${
                isValid ? "via-primary/40" : "via-destructive/40"
              }`}
            />
            <CardHeader className="text-center pt-8 pb-4">
              <div
                className={`mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                  isValid
                    ? "bg-gradient-to-br from-primary to-primary/80 shadow-primary/20"
                    : "bg-destructive/10 shadow-destructive/10"
                }`}
              >
                {isValid ? (
                  <ShieldAlert className="h-7 w-7 text-primary-foreground" />
                ) : (
                  <ShieldCheck className="h-7 w-7 text-destructive" />
                )}
              </div>
              <CardTitle className="text-2xl font-bold">
                {isValid ? tauth("securityAlertTitle") : tauth("securityAlertInvalidTitle")}
              </CardTitle>
              <CardDescription>
                {isValid ? tauth("securityAlertSubtitle") : tauth("securityAlertInvalidDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8 space-y-4">
              {isValid ? (
                <>
                  <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-snug">
                    <p className="flex items-start gap-2">
                      <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{tauth("securityAlertWhatHappens")}</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{tauth("securityAlertWasNotYou")}</span>
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={secure}
                    disabled={busy}
                    data-testid="security-alert-confirm"
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                        {tauth("securityAlertSecuring")}
                      </>
                    ) : (
                      tauth("securityAlertSecureAction")
                    )}
                  </Button>
                  <Link href={`/${locale}/login`} className="block">
                    <Button variant="ghost" className="w-full text-muted-foreground">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      {tauth("securityAlertWasMe")}
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="space-y-4 text-center">
                  {state === "checking" ? (
                    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      {tauth("securityAlertChecking")}
                    </p>
                  ) : (
                    failedToSend && (
                      <p className="text-sm text-destructive" role="alert">
                        {tauth("securityAlertFailed")}
                      </p>
                    )
                  )}
                  <Link href={`/${locale}/login`} className="block">
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      {tauth("backToLogin")}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function SecurityAlertPage() {
  return (
    <Suspense fallback={null}>
      <SecurityAlertView />
    </Suspense>
  );
}
