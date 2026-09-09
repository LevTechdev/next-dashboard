"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { LoaderCircleIcon, EyeIcon, EyeOffIcon } from "lucide-animated";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordStrength } from "@/components/ui/password-strength";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AuthTestimonial } from "@/components/auth/auth-testimonial";
import { toast } from "sonner";

function ResetPasswordForm() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || "en";
  const token = searchParams.get("token") || "";
  const tauth = useTranslations("auth");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(tauth("passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      toast.error(tauth("passwordTooShort"));
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(tauth("passwordResetSuccess"));
        router.push(`/${locale}/login`);
      } else {
        toast.error(data.error || tauth("invalidResetToken"));
      }
    } catch {
      toast.error(tauth("resetError"));
    } finally {
      setIsLoading(false);
    }
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
                <ShieldCheck className="h-7 w-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold">{tauth("resetPasswordTitle")}</CardTitle>
              <CardDescription>{tauth("resetPasswordSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8">
              {!token ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-red-500">{tauth("invalidResetToken")}</p>
                  <Link href={`/${locale}/forgot-password`}>
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      {tauth("forgotPasswordTitle")}
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {tauth("newPassword")}
                    </label>
                    <div className="relative group">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 focus:border-primary"
                        disabled={isLoading}
                        autoComplete="new-password"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOffIcon size={16} className="h-4 w-4" />
                        ) : (
                          <EyeIcon size={16} className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {password && <PasswordStrength password={password} />}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {tauth("confirmPassword")}
                    </label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 focus:border-primary"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-accent-gradient"
                    disabled={!password || !confirm || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <LoaderCircleIcon size={16} className="h-4 w-4 mr-2 animate-spin" />
                        {tauth("resettingPassword")}
                      </>
                    ) : (
                      tauth("resetPasswordButton")
                    )}
                  </Button>

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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
