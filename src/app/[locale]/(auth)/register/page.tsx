"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { EyeIcon, EyeOffIcon, SparklesIcon, XIcon } from "lucide-animated";
import { Loader2, Sun, Moon, ChevronLeft, ChevronRight } from "lucide-react";
import { useResendCooldown } from "@/components/security/use-resend-cooldown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { PasswordStrength } from "@/components/ui/password-strength";

import { toast } from "sonner";

export default function RegisterPage() {
  const params = useParams();
  const locale = params?.locale || "en";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
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
          toast.success("Account created! Check your email for the 6-digit code.");
        } else {
          toast.success("Account created successfully!");
          router.push("/en/dashboard");
        }
      } else {
        toast.error(result.error || "Registration failed");
      }
    } catch {
      toast.error("An error occurred");
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
      setOtpError("Enter the 6-digit code from your email.");
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
          setOtpError("This code has expired. Request a new one below.");
        } else if (errCode === "OTP_TOO_MANY_ATTEMPTS") {
          setOtpError("Too many incorrect attempts. Request a new code below.");
        } else {
          setOtpError(
            data.attemptsLeft
              ? `Incorrect code. ${data.attemptsLeft} attempt(s) left.`
              : "Incorrect code. Request a new one.",
          );
        }
        return;
      }
      toast.success("Email verified!");
      router.push("/en/dashboard");
      router.refresh();
    } catch {
      setOtpError("Something went wrong. Please try again.");
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
        body: JSON.stringify({ locale: "en" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || "Could not resend the code.");
        return;
      }
      if (data.devOtp) setDevOtp(data.devOtp);
      startCooldown();
      toast.success("A new code was sent to your email.");
    } catch {
      setOtpError("Could not resend the code. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#EE5D36] dark:bg-zinc-950 p-4 sm:p-8 transition-colors duration-300">
      {/* Theme Toggle */}
      {mounted && (
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white dark:bg-zinc-900/20 dark:bg-zinc-800/50 backdrop-blur-md border border-white/30 dark:border-zinc-700 text-white hover:bg-white dark:bg-zinc-900/30 dark:hover:bg-zinc-800 transition-all"
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
          <SparklesIcon className="h-8 w-8 text-[#EE5D36] mb-8" />

          {otpRequired ? (
            // --- OTP VERIFICATION VIEW ---
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Verify your email
                </h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-gray-700 dark:text-zinc-300">{email}</span>
                </p>
              </div>

              {devOtp && (
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 p-2.5 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-1">
                    Development OTP
                  </p>
                  <p className="font-mono text-lg font-bold text-gray-800 dark:text-zinc-200 tracking-widest">
                    {devOtp}
                  </p>
                </div>
              )}

              <form onSubmit={verifyOtp} className="space-y-5">
                <div>
                  <Label className="text-gray-700 dark:text-zinc-300 font-medium mb-1.5 block">
                    Confirmation code
                  </Label>
                  <Input
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setOtpError(null);
                    }}
                    placeholder="000000"
                    disabled={verifying}
                    className="w-full h-11 text-center tracking-[0.5em] text-lg font-semibold rounded-xl border-gray-200 dark:border-zinc-800 focus:border-[#EE5D36] focus:ring-[#EE5D36]/20 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                  />
                  {otpError && (
                    <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
                      <XIcon className="h-4 w-4" /> {otpError}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={verifying || otp.length !== 6}
                  className="w-full h-11 rounded-xl bg-[#F5A898] hover:bg-[#EE5D36] transition-colors text-white font-semibold shadow-none"
                >
                  {verifying ? <Loader2 className="animate-spin" /> : "Verify & Continue"}
                </Button>
              </form>

              <div className="text-center pt-2">
                <Button
                  variant="ghost"
                  onClick={resendOtp}
                  disabled={cooldownLeft > 0}
                  className="text-sm text-gray-500 dark:text-zinc-400 hover:text-[#EE5D36]"
                >
                  {cooldownLeft > 0
                    ? `Resend code in ${cooldownLeft}s`
                    : "Didn't receive a code? Resend"}
                </Button>
              </div>
            </div>
          ) : (
            // --- REGISTRATION FORM VIEW ---
            <>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Create Account
              </h1>
              <p className="text-gray-500 dark:text-zinc-400 text-sm mb-8">
                Join the community and start building your future.
              </p>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label className="text-gray-700 dark:text-zinc-300 font-medium mb-1.5 block">
                    Full Name
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl border-gray-200 dark:border-zinc-800 focus:border-[#EE5D36] focus:ring-[#EE5D36]/20 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-zinc-300 font-medium mb-1.5 block">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl border-gray-200 dark:border-zinc-800 focus:border-[#EE5D36] focus:ring-[#EE5D36]/20 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-zinc-300 font-medium mb-1.5 block">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isLoading}
                      className="w-full h-11 rounded-xl border-gray-200 dark:border-zinc-800 focus:border-[#EE5D36] focus:ring-[#EE5D36]/20 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white pr-10"
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
                    Confirm Password
                  </Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl border-gray-200 dark:border-zinc-800 focus:border-[#EE5D36] focus:ring-[#EE5D36]/20 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-[#F5A898] hover:bg-[#EE5D36] transition-colors text-white font-semibold mt-4 shadow-none"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : "Sign Up"}
                </Button>
              </form>

              <p className="text-center text-sm text-gray-500 dark:text-zinc-400 mt-8">
                Already have an account?{" "}
                <Link
                  href={`/${locale}/login`}
                  className="text-[#EE5D36] font-semibold hover:underline"
                >
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>

        {/* RIGHT SIDE: Gradient + Testimonial */}
        <div className="hidden md:flex w-1/2 p-4">
          <div className="w-full h-full rounded-[1.5rem] bg-gradient-to-br from-[#FCE1D4] via-[#F3E7C9] to-[#FCE1D4] p-8 flex flex-col justify-end relative overflow-hidden">
            <div className="bg-white dark:bg-zinc-900/40 backdrop-blur-md border border-white/60 p-8 rounded-3xl shadow-sm">
              <div className="flex gap-2 mb-6">
                <span className="bg-white dark:bg-zinc-900/60 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-800 dark:text-zinc-200">
                  Community of designers
                </span>
                <span className="bg-white dark:bg-zinc-900/60 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-800 dark:text-zinc-200">
                  Creative resources
                </span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white leading-snug mb-8">
                &quot;I was able to reduce the time taken to present high-level designs by 35% using
                the platform.&quot;
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">Sara Bright</p>
                  <p className="text-gray-600 text-xs mt-0.5 font-medium">Freelancer Designer</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-gray-600 shadow-sm cursor-pointer hover:bg-gray-50 dark:bg-zinc-900">
                    <ChevronLeft className="h-4 w-4" />
                  </div>
                  <div className="w-8 h-8 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-gray-600 shadow-sm cursor-pointer hover:bg-gray-50 dark:bg-zinc-900">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
