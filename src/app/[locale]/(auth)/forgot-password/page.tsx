"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { LoaderCircleIcon, CheckIcon } from "lucide-animated";
import { Mail, KeyRound, ArrowLeft, Timer } from "lucide-react";
import {
  FORGOT_PASSWORD_COOLDOWN_KEY,
  useResendCooldown,
} from "@/components/security/use-resend-cooldown";

// Kept for tests / callers that imported the key from this page.
export { FORGOT_PASSWORD_COOLDOWN_KEY };
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AuthTestimonial } from "@/components/auth/auth-testimonial";
import { toast } from "sonner";

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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-primary dark:bg-zinc-950 p-4 transition-colors duration-300">

      <div className="relative z-10 flex w-full max-w-[1000px] items-center justify-center gap-8 md:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as any }}
          className="w-full max-w-md shrink-0"
        >
          <div className="mb-8 flex justify-center">
            <BrandLogo animated />
          </div>
          <Card className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-white/20 dark:border-zinc-800/50 shadow-2xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0" />

            <CardHeader className="text-center pt-8 pb-4">
              <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                <KeyRound className="h-7 w-7 text-primary-foreground" />
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
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-zinc-700 dark:text-zinc-200">
                    <CheckIcon size={16} className="h-4 w-4" />
                    {tauth("resetLinkSent")}
                  </div>
                  {devResetUrl && (
                    <a
                      href={devResetUrl}
                      className="block text-center text-xs text-primary break-all hover:underline"
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
                        className="text-primary font-medium hover:underline transition-colors disabled:opacity-50"
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
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-10 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 focus:border-primary"
                        disabled={isLoading}
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-accent-gradient"
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
                    {tauth("backToLogin")}
                  </Link>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="hidden md:flex h-[520px] w-[380px] lg:w-[440px] shrink-0">
          <AuthTestimonial />
        </div>
      </div>
    </div>
  );
}
