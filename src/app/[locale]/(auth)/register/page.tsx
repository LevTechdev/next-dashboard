"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { EyeIcon, EyeOffIcon, XIcon } from "lucide-animated";
import { Loader2, Sun, Moon } from "lucide-react";
import { AuthTestimonial } from "@/components/auth/auth-testimonial";
import { useResendCooldown } from "@/components/security/use-resend-cooldown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { PasswordStrength } from "@/components/ui/password-strength";
import { BrandLogo } from "@/components/brand/brand-logo";

import { toast } from "sonner";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const params = useParams();
  const locale = params?.locale || "en";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // ── Email-OTP verification step (shown right after signup) ──
  const [otpRequired, setOtpRequired] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const { cooldownLeft, startCooldown } = useResendCooldown();
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password) {
      toast.error(t("pleaseFillFields"));
      return;
    }

    if (password.length < 6) {
      toast.error(t("passwordMinLength"));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }

    setIsLoading(true);
    try {
      const result = await register(name, email, password);
      if (result.success) {
        if (result.emailOtpRequired) {
          // Verify identity with the emailed 6-digit code before entering.
          setOtpRequired(true);
          setDevOtp(result.devOtp ?? null);
          setOtpError(null);
          toast.success(t("accountCreatedCheckEmail"));
        } else {
          toast.success(t("accountCreated"));
          router.push("/en/dashboard");
        }
      } else {
        toast.error(result.error || t("errorGeneric"));
      }
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setIsLoading(false);
    }
  };

  // Guards against double submission (auto-submit on the 6th digit + the form
  // submit firing for the same code). Reset in the finally of submitOtp.
  const otpSubmittingRef = useRef(false);

  /**
   * Submit the given code to the verify-email endpoint. Shared by the form's
   * submit handler and the auto-submit that fires when the 6th digit is typed
   * (so the OTP step never needs the button to complete).
   */
  const submitOtp = async (code: string) => {
    if (!/^\d{6}$/.test(code)) {
      setOtpError(t("otpFormatError"));
      return;
    }
    if (otpSubmittingRef.current) return;
    otpSubmittingRef.current = true;
    setVerifying(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/auth/verify-email/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errCode = data.error;
        if (errCode === "OTP_EXPIRED") {
          setOtpError(t("otpExpired"));
        } else if (errCode === "OTP_TOO_MANY_ATTEMPTS") {
          setOtpError(t("otpTooManyAttempts"));
        } else {
          setOtpError(
            data.attemptsLeft
              ? t("otpIncorrectAttempts", { attempts: data.attemptsLeft })
              : t("otpIncorrect"),
          );
        }
        return;
      }
      toast.success(t("emailVerifiedToast"));
      // Stay in the registering locale — pushing a hard-coded /en/dashboard
      // would drop an id/ja user onto the English dashboard.
      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch {
      setOtpError(t("otpGenericError"));
    } finally {
      otpSubmittingRef.current = false;
      setVerifying(false);
    }
  };

  const verifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void submitOtp(otp);
  };

  const resendOtp = async () => {
    setVerifying(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/auth/verify-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || "Could not resend the code.");
        return;
      }
      if (data.devOtp) setDevOtp(data.devOtp);
      startCooldown();
      toast.success(t("newCodeSentToast"));
    } catch {
      setOtpError(t("resendFailedGeneric"));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-primary dark:bg-zinc-950 p-4 sm:p-8 transition-colors duration-300">
      {/* Theme Toggle */}
      {mounted && (
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white dark:bg-zinc-800/80 backdrop-blur-md border border-black/5 dark:border-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700/80 transition-all"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col md:flex-row w-full max-w-[1000px] bg-white dark:bg-zinc-900 dark:bg-zinc-900 rounded-[2rem] shadow-2xl overflow-hidden border border-transparent dark:border-zinc-800"
      >
        {/* LEFT SIDE: Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center relative">
          <div className="mb-8 flex justify-center">
            <BrandLogo animated />
          </div>

          {otpRequired ? (
            // --- OTP VERIFICATION VIEW ---
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {t("verifyEmailTitle")}
                </h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">
                  {t("verifyEmailDesc")}{" "}
                  <span className="font-semibold text-gray-700 dark:text-zinc-300">{email}</span>
                </p>
              </div>

              {devOtp && (
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 p-2.5 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-1">
                    {t("developmentOtp")}
                  </p>
                  <p
                    data-testid="dev-otp"
                    className="font-mono text-lg font-bold text-gray-800 dark:text-zinc-200 tracking-widest"
                  >
                    {devOtp}
                  </p>
                </div>
              )}

              <form onSubmit={verifyOtp} className="space-y-5">
                <div>
                  <Label className="text-gray-700 dark:text-zinc-300 font-medium mb-1.5 block">
                    {t("confirmationCode")}
                  </Label>
                  <Input
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setOtpError(null);
                    }}
                    placeholder="000000"
                    disabled={verifying}
                    className="w-full h-11 text-center tracking-[0.5em] text-lg font-semibold rounded-xl border-gray-200 dark:border-zinc-800 focus:border-primary focus:ring-primary/40 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                  />
                  {otpError && (
                    <div className="text-sm text-red-500 mt-2 flex items-center gap-1">
                      <XIcon className="h-4 w-4" /> {otpError}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={verifying || otp.length !== 6}
                  className="w-full h-11 rounded-xl bg-primary bg-accent-gradient hover:bg-primary/90 transition-colors text-primary-foreground font-semibold shadow-none"
                >
                  {verifying ? <Loader2 className="animate-spin" /> : t("verifyContinue")}
                </Button>
              </form>

              <div className="text-center pt-2">
                <Button
                  variant="ghost"
                  onClick={resendOtp}
                  disabled={cooldownLeft > 0}
                  className="text-sm text-gray-500 dark:text-zinc-400 hover:text-primary"
                >
                  {cooldownLeft > 0
                    ? t("resendCodeIn", { seconds: cooldownLeft })
                    : t("didntReceiveCode")}
                </Button>
              </div>
            </div>
          ) : (
            // --- REGISTRATION FORM VIEW ---
            <>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {t("registerTitle")}
              </h1>
              <p className="text-gray-500 dark:text-zinc-400 text-sm mb-8">
                {t("registerSubtitle")}
              </p>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label className="text-gray-700 dark:text-zinc-300 font-medium mb-1.5 block">
                    {t("fullName")}
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl border-gray-200 dark:border-zinc-800 focus:border-primary focus:ring-primary/40 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-zinc-300 font-medium mb-1.5 block">
                    {t("email")}
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl border-gray-200 dark:border-zinc-800 focus:border-primary focus:ring-primary/40 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-zinc-300 font-medium mb-1.5 block">
                    {t("password")}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isLoading}
                      className="w-full h-11 rounded-xl border-gray-200 dark:border-zinc-800 focus:border-primary focus:ring-primary/40 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {password && <PasswordStrength password={password} />}
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-zinc-300 font-medium mb-1.5 block">
                    {t("confirmPasswordLabel")}
                  </Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl border-gray-200 dark:border-zinc-800 focus:border-primary focus:ring-primary/40 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-primary bg-accent-gradient hover:bg-primary/90 transition-colors text-primary-foreground font-semibold mt-4 shadow-none"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : t("signUpButton")}
                </Button>
              </form>

              <p className="text-center text-sm text-gray-500 dark:text-zinc-400 mt-8">
                {t("haveAccount")}{" "}
                <Link
                  href={`/${locale}/login`}
                  className="text-primary font-semibold hover:underline"
                >
                  {t("login")}
                </Link>
              </p>
            </>
          )}
        </div>

        {/* RIGHT SIDE: Customer review (i18n) */}
        <div className="hidden md:flex w-1/2 p-4 pl-0">
          <AuthTestimonial />
        </div>
      </motion.div>
    </div>
  );
}
