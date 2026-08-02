"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { LoaderCircleIcon, CheckIcon } from "lucide-animated";
import { Mail, KeyRound, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const tauth = useTranslations("auth");

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
        if (data.resetUrl) setDevResetUrl(data.resetUrl);
      } else {
        toast.error(data.error || tauth("resetError"));
      }
    } catch {
      toast.error(tauth("resetError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-50 dark:bg-[#0b0c11] p-4">
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/8 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-purple-500/8 dark:bg-purple-500/6 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as any }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-white/20 dark:border-zinc-800/50 shadow-2xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-purple-500/0" />

          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
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
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckIcon size={16} className="h-4 w-4" />
                  {tauth("resetLinkSent")}
                </div>
                {devResetUrl && (
                  <a
                    href={devResetUrl}
                    className="block text-center text-xs text-indigo-500 hover:text-indigo-400 break-all"
                  >
                    {devResetUrl}
                  </a>
                )}
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
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {tauth("email")}
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 focus:border-indigo-400 dark:focus:border-indigo-500"
                      disabled={isLoading}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11" disabled={!email || isLoading}>
                  {isLoading ? (
                    <>
                      <LoaderCircleIcon size={16} className="h-4 w-4 mr-2 animate-spin" />
                      {tauth("sendingResetLink")}
                    </>
                  ) : (
                    tauth("sendResetLink")
                  )}
                </Button>

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
