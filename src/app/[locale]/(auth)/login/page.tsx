"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { LoaderCircleIcon } from "lucide-animated";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Building2,
  Sun,
  Moon,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useTranslations } from "next-intl";

function LoginForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [view, setView] = useState("login");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [totpCode, setTotpCode] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/en/dashboard";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
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
        toast.success("Welcome back!");
        router.push(redirect);
      } else {
        toast.error(result.error || "Login failed");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const totpSubmittingRef = useRef(false);

  const handleTotpVerification = async (code: string) => {
    if (code.length < 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    if (totpSubmittingRef.current) return;
    totpSubmittingRef.current = true;
    setIsLoading(true);
    try {
      const result = await login(savedEmail, savedPassword, code);
      if (result.success) {
        toast.success("Welcome back!");
        router.push(redirect);
      } else {
        toast.error(result.error || "Invalid code");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      totpSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F25C38] dark:bg-zinc-950 p-4 sm:p-8 relative transition-colors duration-300">
      {mounted && (
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="absolute top-4 right-4 sm:top-8 sm:right-8 p-3 rounded-full bg-white dark:bg-zinc-900/20 hover:bg-white dark:bg-zinc-900/30 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 backdrop-blur-md transition-all text-zinc-900 dark:text-white shadow-sm z-50"
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 hidden dark:block" />
          <Moon className="h-5 w-5 block dark:hidden" />
        </button>
      )}

      <div className="w-full max-w-[1000px] bg-white dark:bg-zinc-900 dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-white/20 dark:border-zinc-800 transition-colors">
        {/* Left Side */}
        <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center">
          <div className="w-full max-w-sm mx-auto">
            <div className="flex items-center gap-2 text-[#F25C38] mb-6">
              <Sparkles className="w-8 h-8 fill-current" />
              <span className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Next Dashboard</span>
            </div>

            {totpRequired ? (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">{t("twoFactorAuth")}</h1>
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
                              ? "border-[#F25C38] ring-1 ring-[#F25C38]"
                              : "border-zinc-200",
                            totpCode[i] ? "text-zinc-900" : "text-transparent",
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
                    className="w-full h-12 text-sm font-medium bg-[#F25C38] hover:bg-[#D94C2B] text-white rounded-xl shadow-lg shadow-orange-500/20"
                    disabled={totpCode.length < 6 || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <LoaderCircleIcon className="h-4 w-4 mr-2 animate-spin" /> Verifying...
                      </>
                    ) : (
                      "Verify & Login"
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setTotpRequired(false);
                      setTotpCode("");
                    }}
                    className="w-full text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    ← Back to login
                  </button>
                </form>
              </>
            ) : view === "forgot" ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                    {t("forgotPasswordTitle")}
                  </h1>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                    {t("forgotPasswordSubtitle")}
                  </p>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    toast.success(t("resetLinkSent"));
                    setView("login");
                  }}
                  className="space-y-5"
                >
                  <div>
                    <Label className="text-zinc-700 dark:text-zinc-300 font-medium mb-1.5 block">
                      {t("email")}
                    </Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@dashboard.com"
                      disabled={isLoading}
                      className="w-full h-12 rounded-xl border-zinc-200 dark:border-zinc-800 focus:border-[#F25C38] focus:ring-[#F25C38]/20 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl bg-[#F5A898] hover:bg-[#EE5D36] transition-colors text-white font-semibold mt-2 shadow-none"
                  >
                    {isLoading ? (
                      <LoaderCircleIcon size={16} className="animate-spin" />
                    ) : (
                      t("sendResetLink")
                    )}
                  </Button>
                </form>

                <div className="text-center pt-4">
                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-[#EE5D36] dark:text-zinc-400 dark:hover:text-[#EE5D36] transition-colors"
                  >
                    Back to log in
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">{t("welcomeBack")}</h1>
                <p className="text-sm text-zinc-500 mb-8">{t("loginDescription")}</p>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-700">{t("email")}</Label>
                    <Input
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 focus:border-[#F25C38] focus:ring-[#F25C38]/20 rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-zinc-700 dark:text-zinc-300">{t("password")}</Label>
                      <Link href={`/en/forgot-password`} className="text-sm font-medium text-[#F25C38] hover:underline">{t("forgotPassword")}</Link>
                    </div>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={t("passwordPlaceholder")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 bg-white dark:bg-zinc-900 border-zinc-200 focus:border-[#F25C38] focus:ring-[#F25C38]/20 rounded-xl pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-sm font-medium bg-[#F25C38] hover:bg-[#D94C2B] text-white rounded-xl shadow-lg shadow-orange-500/20 mt-2"
                    disabled={!email || !password || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <LoaderCircleIcon size={16} className="h-4 w-4 mr-2 animate-spin" /> {t("loggingIn")}
                      </>
                    ) : t("loginButton")}
                  </Button>
                </form>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase font-medium">
                    <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400">OR</span>
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
                  {t("noAccount")} <Link href="/en/register" className="text-[#F25C38] hover:underline">{t("createOne")}</Link>
                </p>

                <p className="mt-2 text-center text-xs text-zinc-400">
                  Demo: nextdashboards@gmail.com / admin123
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right Side Visual */}
        <div className="hidden md:flex md:w-[400px] lg:w-[480px] p-4 pl-0">
          <div className="w-full h-full rounded-2xl overflow-hidden relative bg-gradient-to-br from-orange-200 via-orange-100 to-amber-100 flex items-end p-6">
            {/* Soft decorative blur shapes */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-400/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-1/4 left-0 w-[300px] h-[300px] bg-rose-400/20 rounded-full blur-[60px] -translate-x-1/2" />

            {/* Glass Card */}
            <div className="relative z-10 w-full backdrop-blur-xl bg-white dark:bg-zinc-900/20 border border-white/40 p-8 rounded-[24px] shadow-2xl">
              <div className="flex gap-2 mb-6">
                <span className="px-4 py-1.5 bg-white dark:bg-zinc-900/30 text-zinc-800 text-xs font-semibold rounded-full border border-white/20 shadow-sm backdrop-blur-md">
                  Community of designers
                </span>
                <span className="px-4 py-1.5 bg-white dark:bg-zinc-900/30 text-zinc-800 text-xs font-semibold rounded-full border border-white/20 shadow-sm backdrop-blur-md">
                  Creative resources
                </span>
              </div>
              <p className="text-zinc-900 font-semibold text-lg sm:text-xl mb-8 leading-snug">
                &quot;I was able to reduce the time taken to present high-level designs by 35% using
                the platform.&quot;
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-900 font-bold text-sm">Sara Bright</p>
                  <p className="text-zinc-800/80 text-xs font-medium mt-0.5">Freelancer Designer</p>
                </div>
                <div className="flex gap-2">
                  <button className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-900 hover:bg-zinc-50 shadow-sm transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-900 hover:bg-zinc-50 shadow-sm transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F25C38]">
          <LoaderCircleIcon size={32} className="h-8 w-8 animate-spin text-white" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
