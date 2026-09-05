"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { LoaderCircleIcon } from "lucide-animated";
import { Fingerprint, Building2, Sun, Moon, Eye, EyeOff, Timer } from "lucide-react";
import { AuthTestimonial } from "@/components/auth/auth-testimonial";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  FORGOT_PASSWORD_COOLDOWN_KEY,
  useResendCooldown,
} from "@/components/security/use-resend-cooldown";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useTranslations } from "next-intl";

function LoginForm() {
  const t = useTranslations("auth");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [view, setView] = useState("login");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // eslint-disable-line react-hooks/set-state-in-effect

  const [totpCode, setTotpCode] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || `/${locale}/dashboard`;

  // ── Inline forgot-password state (styled like the 2FA step) ──
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotDevUrl, setForgotDevUrl] = useState<string | null>(null);
  const { cooldownLeft, startCooldown } = useResendCooldown({
    storageKey: FORGOT_PASSWORD_COOLDOWN_KEY,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t("enterEmailPassword"));
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.requires2FA) {
        setSavedEmail(email);
        setSavedPassword(password);
        setTotpRequired(true);
        setIsLoading(false);
        return;
      }
      if (result.success) {
        toast.success(t("welcomeBackToast"));
        router.push(redirect);
      } else {
        toast.error(result.error || t("loginFailed"));
      }
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setIsLoading(false);
    }
  };

  const totpSubmittingRef = useRef(false);

  const handleTotpVerification = async (code: string) => {
    if (code.length < 6) {
      toast.error(t("invalidCodeLength"));
      return;
    }
    if (totpSubmittingRef.current) return;
    totpSubmittingRef.current = true;
    setIsLoading(true);
    try {
      const result = await login(savedEmail, savedPassword, code);
      if (result.success) {
        toast.success(t("welcomeBackToast"));
        router.push(redirect);
      } else {
        toast.error(result.error || t("invalidCode"));
      }
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      totpSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const goToForgot = () => {
    setForgotSent(false);
    setForgotDevUrl(null);
    setView("forgot");
  };

  const goToLogin = () => {
    setForgotSent(false);
    setForgotDevUrl(null);
    setView("login");
  };

  const sendForgotLink = async () => {
    if (!email) {
      toast.error(t("email"));
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotSent(true);
        if (data.resetUrl) setForgotDevUrl(data.resetUrl);
        startCooldown();
        return;
      }
      toast.error(data.error || t("resetError"));
    } catch {
      toast.error(t("resetError"));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const { theme, setTheme } = useTheme();

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-primary dark:bg-zinc-950 p-4 sm:p-8 transition-colors duration-300">
      {mounted && (
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="absolute top-4 right-4 sm:top-8 sm:right-8 p-3 rounded-full bg-white dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 backdrop-blur-md transition-all text-zinc-900 dark:text-white shadow-sm z-50"
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 hidden dark:block" />
          <Moon className="h-5 w-5 block dark:hidden" />
        </button>
      )}

      <div className="w-full max-w-[1000px] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-white/20 dark:border-zinc-800 transition-colors">
        {/* Left Side */}
        <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center">
          <div className="w-full max-w-sm mx-auto">
            <div className="mb-6 flex justify-center">
              <BrandLogo animated />
            </div>

            {totpRequired ? (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                  {t("twoFactorAuth")}
                </h1>
                <p className="text-sm text-zinc-500 mb-8">{t("twoFactorDescription")}</p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleTotpVerification(totpCode);
                  }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <Label className="text-zinc-700">{t("verificationCode")}</Label>
                    <div className="relative flex justify-between gap-2 w-full">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex-1 aspect-square sm:h-14 border rounded-lg flex items-center justify-center text-xl sm:text-2xl font-mono transition-colors",
                            totpCode.length === i
                              ? "border-primary ring-1 ring-primary"
                              : "border-zinc-200 dark:border-zinc-700",
                            totpCode[i] ? "text-zinc-900 dark:text-zinc-100" : "text-transparent",
                          )}
                        >
                          {totpCode[i] || ""}
                        </div>
                      ))}
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => {
                          const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setTotpCode(next);
                          if (next.length === 6) {
                            void handleTotpVerification(next);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                        autoFocus
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-sm font-medium text-primary-foreground bg-accent-gradient rounded-xl shadow-lg shadow-primary/20"
                    disabled={totpCode.length < 6 || isLoading}
                  >
                    {" "}
                    {isLoading ? (
                      <>
                        <LoaderCircleIcon size={16} className="h-4 w-4 mr-2 animate-spin" />{" "}
                        {t("verifying")}
                      </>
                    ) : (
                      t("verifyAndLogin")
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setTotpRequired(false);
                      setTotpCode("");
                    }}
                    className="w-full text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                  >
                    ← Back to login
                  </button>
                </form>
              </>
            ) : view === "forgot" ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                    {forgotSent ? t("resetLinkSent") : t("forgotPasswordTitle")}
                  </h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
                    {forgotSent ? t("resetLinkSentDesc") : t("forgotPasswordSubtitle")}
                  </p>
                </div>

                {forgotSent ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-zinc-700 dark:text-zinc-200">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      {t("resetLinkSent")}
                    </div>

                    {forgotDevUrl && (
                      <a
                        href={forgotDevUrl}
                        className="block text-center text-xs text-primary break-all hover:underline"
                      >
                        {forgotDevUrl}
                      </a>
                    )}

                    <div className="flex items-center justify-center gap-3 text-sm">
                      {cooldownLeft > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-zinc-400">
                          <Timer className="h-3.5 w-3.5" />
                          {t("resendInSeconds", { seconds: cooldownLeft })}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void sendForgotLink()}
                          disabled={forgotLoading}
                          className="text-primary font-medium hover:underline transition-colors disabled:opacity-50"
                        >
                          {forgotLoading ? t("sendingResetLink") : t("resendResetLink")}
                        </button>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11"
                      onClick={goToLogin}
                    >
                      {t("backToLogin")}
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void sendForgotLink();
                    }}
                    className="space-y-5"
                  >
                    <div>
                      <Label className="text-zinc-700 dark:text-zinc-300 font-medium mb-1.5 block">
                        {t("email")}
                      </Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("emailPlaceholder")}
                        disabled={forgotLoading}
                        autoFocus
                        required
                        className="w-full h-12 rounded-xl border-zinc-200 dark:border-zinc-800 focus:border-primary focus:ring-primary/40 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!email || forgotLoading || cooldownLeft > 0}
                      className="w-full h-11 rounded-xl text-primary-foreground bg-accent-gradient font-semibold mt-2 shadow-none"
                    >
                      {forgotLoading ? (
                        <>
                          <LoaderCircleIcon size={16} className="h-4 w-4 mr-2 animate-spin" />
                          {t("sendingResetLink")}
                        </>
                      ) : cooldownLeft > 0 ? (
                        t("resendInSeconds", { seconds: cooldownLeft })
                      ) : (
                        t("sendResetLink")
                      )}
                    </Button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={goToLogin}
                        className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-primary dark:text-zinc-400 transition-colors"
                      >
                        {t("backToLogin")}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                  {t("welcomeBack")}
                </h1>
                <p className="text-sm text-zinc-500 mb-8">{t("loginDescription")}</p>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-700">{t("email")}</Label>
                    <Input
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:border-primary focus:ring-primary/40 rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-zinc-700 dark:text-zinc-300">{t("password")}</Label>
                      <button
                        type="button"
                        onClick={goToForgot}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t("forgotPassword")}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={t("passwordPlaceholder")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:border-primary focus:ring-primary/40 rounded-xl pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-sm font-medium text-primary-foreground bg-accent-gradient rounded-xl shadow-lg shadow-primary/20 mt-2"
                    disabled={!email || !password || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <LoaderCircleIcon size={16} className="h-4 w-4 mr-2 animate-spin" />{" "}
                        {t("loggingIn")}
                      </>
                    ) : (
                      t("loginButton")
                    )}
                  </Button>
                </form>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase font-medium">
                    <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400">{t("or")}</span>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleGoogleLogin}
                    type="button"
                    className="flex-1 h-12 border border-zinc-200 rounded-xl flex items-center justify-center hover:bg-zinc-50 transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="flex-1 h-12 border border-zinc-200 rounded-xl flex items-center justify-center hover:bg-zinc-50 transition-colors"
                  >
                    <Fingerprint className="h-5 w-5 text-zinc-700" />
                  </button>
                  <button
                    type="button"
                    className="flex-1 h-12 border border-zinc-200 rounded-xl flex items-center justify-center hover:bg-zinc-50 transition-colors"
                  >
                    <Building2 className="h-5 w-5 text-zinc-700" />
                  </button>
                </div>

                <p className="mt-8 text-center text-sm text-zinc-500 font-medium">
                  {t("noAccount")}{" "}
                  <Link
                    href={`/${locale}/register`}
                    className="text-primary font-semibold hover:underline"
                  >
                    {t("createOne")}
                  </Link>
                </p>

                <p className="mt-2 text-center text-xs text-zinc-400">
                  Demo: nextdashboards@gmail.com / admin123
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right Side Visual — customer review (i18n) */}
        <div className="hidden md:flex md:w-[400px] lg:w-[480px] p-4 pl-0">
          <AuthTestimonial />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-primary">
          <LoaderCircleIcon size={32} className="h-8 w-8 animate-spin text-primary-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
