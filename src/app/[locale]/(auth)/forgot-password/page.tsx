"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { LoaderCircleIcon, CheckIcon } from "lucide-animated";
import { Mail, KeyRound, ArrowLeft, Timer } from "lucide-react";
import { useResendCooldown } from "@/components/security/use-resend-cooldown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Forgot-password resends keep an independent cooldown from email-verification
// sends, so requesting a reset link never blocks (or is blocked by) the OTP
// resend on the Security Center / profile page.
export const FORGOT_PASSWORD_COOLDOWN_KEY = "forgot-password-cooldown-until";

export default function ForgotPasswordPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const tauth = useTranslations("auth");

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const { cooldownLeft, startCooldown } = useResendCooldown({
    storageKey: FORGOT_PASSWORD_COOLDOWN_KEY,
  });

  const sendResetLink = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
        if (data.resetUrl) setDevResetUrl(data.resetUrl);
        startCooldown();
        return true;
      }
      toast.error(data.error || tauth("resetError"));
      return false;
    } catch {
      toast.error(tauth("resetError"));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResetLink();
  };

  const handleResend = async () => {
    const ok = await sendResetLink();
    if (ok) toast.success(tauth("resetLinkSent"));
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-50 dark:bg-[#0b0c11] p-4">
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-lime-500/10 dark:bg-indigo-500/8 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-lime-500/8 dark:bg-purple-500/6 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as any }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-white/20 dark:border-zinc-800/50 shadow-2xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-lime-500/0 via-lime-500/50 to-lime-600/0 dark:from-indigo-500/0 dark:via-indigo-500/50 dark:to-purple-500/0" />

          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-500 to-lime-600 dark:from-indigo-500 dark:to-purple-600 flex items-center justify-center shadow-lg shadow-lime-500/20 dark:shadow-indigo-500/20">
              <KeyRound className="h-7 w-7 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {sent ? tauth("resetLinkSent") : tauth("forgotPasswordTitle")}
            </CardTitle>
            <CardDescription>
              {sent ? tauth("resetLinkSentDesc") : tauth("forgotPasswordSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8">
            {sent ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-lime-50 dark:bg-emerald-900/20 border border-lime-200 dark:border-emerald-800 text-sm text-lime-700 dark:text-emerald-400">
                  <CheckIcon size={16} className="h-4 w-4" />
                  {tauth("resetLinkSent")}
                </div>
                {devResetUrl && (
                  <a
                    href={devResetUrl}
                    className="block text-center text-xs text-lime-600 hover:text-lime-500 dark:text-indigo-400 dark:hover:text-indigo-300 break-all"
                  >
                    {devResetUrl}
                  </a>
                )}
                <div className="flex items-center justify-center gap-3 text-sm">
                  {cooldownLeft > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-zinc-400">
                      <Timer className="h-3.5 w-3.5" />
                      {tauth("resendInSeconds", { seconds: cooldownLeft })}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isLoading}
                      className="text-lime-600 dark:text-indigo-400 hover:text-lime-500 font-medium transition-colors disabled:opacity-50"
                    >
                      {isLoading ? tauth("sendingResetLink") : tauth("resendResetLink")}
                    </button>
                  )}
                </div>
                <Link href={`/${locale}/login`}>
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {tauth("backToLogin")}
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{tauth("email")}</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-lime-500 dark:group-focus-within:text-indigo-500 transition-colors" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 focus:border-lime-400 dark:focus:border-indigo-500"
                      disabled={isLoading}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={!email || isLoading || cooldownLeft > 0}
                >
                  {isLoading ? (
                    <>
                      <LoaderCircleIcon size={16} className="h-4 w-4 mr-2 animate-spin" />
                      {tauth("sendingResetLink")}
                    </>
                  ) : (
                    tauth("sendResetLink")
                  )}
                </Button>

                {cooldownLeft > 0 && (
                  <p className="text-center text-xs text-zinc-400 inline-flex items-center justify-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" />
                    {tauth("resendInSeconds", { seconds: cooldownLeft })}
                  </p>
                )}

                <Link
                  href={`/${locale}/login`}
                  className="block text-center text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                >
                  ← {tauth("backToLogin")}
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
