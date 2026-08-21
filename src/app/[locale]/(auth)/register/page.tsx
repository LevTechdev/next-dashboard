"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckIcon, XIcon } from "lucide-animated";
import {
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
  Mail,
  User,
  LayoutDashboard,
  Sparkles,
  KeyRound,
  Timer,
  MailCheck,
} from "lucide-react";
import { useResendCooldown } from "@/components/security/use-resend-cooldown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AnimatedRays } from "@/components/ui/animated-rays";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { ShimmerButton } from "@/components/ui/shimmer-button";

export default function RegisterPage() {
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
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const { cooldownLeft, startCooldown } = useResendCooldown();
  const { register } = useAuth();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

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

  const passwordStrength = password.length;
  const getStrengthLabel = () => {
    if (passwordStrength === 0) return "";
    if (passwordStrength < 6) return "Weak";
    if (passwordStrength < 10) return "Medium";
    return "Strong";
  };
  const getStrengthColor = () => {
    if (passwordStrength < 6) return "bg-red-500";
    if (passwordStrength < 10) return "bg-yellow-500";
    return "bg-green-500";
  };

  const hasMinChars = password.length >= 6;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  // Pointer tracking glow
  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty("--mouse-x", `${x}px`);
    cardRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as any } },
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-50 dark:bg-[#0b0c11] p-4">
      {/* ═══ BACKGROUND EFFECTS ═══ */}
      <div className="absolute inset-0">
        <AnimatedRays />
        <AnimatedGridPattern
          numSquares={60}
          maxOpacity={0.05}
          duration={4}
          repeatDelay={1}
          className="opacity-50"
        />
      </div>

      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-lime-500/10 dark:bg-emerald-500/8 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-lime-500/8 dark:bg-teal-500/6 rounded-full blur-[120px] pointer-events-none" />

      {/* ═══ REGISTER CARD ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as any }}
        className="relative z-10 w-full max-w-md"
        ref={cardRef}
        onPointerMove={handlePointerMove}
      >
        {/* Brand Logo Link */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex justify-center mb-6"
        >
          <Link href="/en" className="flex items-center gap-2.5 group">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-lime-500 text-white dark:bg-foreground dark:text-background shadow-lg shadow-lime-500/30 dark:shadow-none transition-shadow group-hover:shadow-xl">
              <LayoutDashboard className="h-[20px] w-[20px]" />
            </div>
            <span className="text-sm font-semibold text-foreground">Dashboard</span>
          </Link>
        </motion.div>

        <Card className="glow-border backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-white/20 dark:border-zinc-800/50 shadow-2xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
          {/* Subtle gradient top border */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-lime-500/0 via-lime-500/50 to-lime-600/0 dark:from-emerald-500/0 dark:via-emerald-500/50 dark:to-teal-500/0" />

          <CardHeader className="text-center pt-8 pb-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-500 to-lime-600 dark:from-emerald-500 dark:to-teal-600 flex items-center justify-center shadow-lg shadow-lime-500/20 dark:shadow-emerald-500/20"
            >
              <UserPlus className="h-7 w-7 text-white" />
            </motion.div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-800 dark:from-white dark:via-zinc-100 dark:to-white bg-clip-text text-transparent">
              Create Account
            </CardTitle>
            <CardDescription className="flex items-center justify-center gap-1">
              Get started with your free dashboard
              <Sparkles className="h-3 w-3 text-lime-500 dark:text-emerald-400" />
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8">
            {otpRequired ? (
              <div className="space-y-4">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-500 to-lime-600 dark:from-indigo-500 dark:to-violet-600 flex items-center justify-center shadow-lg shadow-lime-500/20 dark:shadow-indigo-500/20"
                >
                  <MailCheck className="h-7 w-7 text-white" />
                </motion.div>
                <div className="text-center space-y-1">
                  <p className="text-xl font-bold bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-800 dark:from-white dark:via-zinc-100 dark:to-white bg-clip-text text-transparent">
                    Verify your email
                  </p>
                  <p className="text-sm text-zinc-500">
                    We sent a 6-digit code to{" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{email}</span>.
                    Enter it below to confirm your identity.
                  </p>
                </div>

                <form onSubmit={verifyOtp} className="space-y-3">
                  <div className="relative group">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-lime-500 dark:group-focus-within:text-indigo-500 transition-colors" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      pattern="\d{6}"
                      value={otp}
                      onChange={(e) => {
                        const next = e.target.value.replace(/\D/g, "");
                        setOtp(next);
                        // Auto-verify as soon as all 6 digits are entered.
                        if (next.length === 6) {
                          void submitOtp(next);
                        }
                      }}
                      placeholder="6-digit code"
                      className="pl-10 text-center tracking-[0.5em] text-lg font-semibold bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 focus:border-lime-400 dark:focus:border-indigo-500 transition-all"
                      disabled={verifying}
                    />
                  </div>

                  {otpError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-500 text-center"
                    >
                      {otpError}
                    </motion.p>
                  )}

                  {devOtp && (
                    <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 text-center">
                      <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                        Development code
                      </p>
                      <p
                        data-testid="dev-otp"
                        className="text-lg font-bold tracking-[0.3em] text-zinc-700 dark:text-zinc-200"
                      >
                        {devOtp}
                      </p>
                    </div>
                  )}

                  <ShimmerButton
                    type="submit"
                    className="w-full h-11 text-sm font-medium"
                    disabled={verifying || otp.length !== 6}
                    shimmerColor="rgba(132, 204, 22, 0.5)"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...
                      </>
                    ) : (
                      <>
                        <MailCheck className="h-4 w-4 mr-2" /> Verify Email
                      </>
                    )}
                  </ShimmerButton>

                  <div className="flex items-center justify-center gap-3 text-sm">
                    {cooldownLeft > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <Timer className="h-3.5 w-3.5" /> Resend in {cooldownLeft}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={resendOtp}
                        disabled={verifying}
                        className="text-lime-600 dark:text-indigo-400 hover:text-lime-500 font-medium transition-colors disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    )}
                  </div>

                  <p className="text-center">
                    <Link
                      href="/en/dashboard"
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      Skip for now — I&apos;ll verify later
                    </Link>
                  </p>
                </form>
              </div>
            ) : (
              <>
                <motion.form
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  <motion.div variants={itemVariants} className="space-y-2">
                    <Label>Full Name</Label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-lime-500 dark:group-focus-within:text-emerald-500 transition-colors" />
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="pl-10 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 focus:border-lime-400 dark:focus:border-emerald-500 transition-all"
                        disabled={isLoading}
                        autoComplete="name"
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants} className="space-y-2">
                    <Label>Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-lime-500 dark:group-focus-within:text-emerald-500 transition-colors" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-10 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 focus:border-lime-400 dark:focus:border-emerald-500 transition-all"
                        disabled={isLoading}
                        autoComplete="email"
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants} className="space-y-2">
                    <Label>Password</Label>
                    <div className="relative group">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className={cn(
                          "pr-10 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 focus:border-lime-400 dark:focus:border-emerald-500 transition-all",
                          password.length > 0 &&
                            !hasMinChars &&
                            "border-red-300 dark:border-red-800 focus:border-red-400",
                        )}
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Password Strength Bar */}
                    {password.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layout
                        className="space-y-2 pt-1 overflow-hidden"
                      >
                        <div className="flex gap-1">
                          {[1, 2, 3].map((level) => (
                            <div
                              key={level}
                              className={cn(
                                "h-1.5 flex-1 rounded-full transition-all duration-300",
                                passwordStrength >= level * 3
                                  ? getStrengthColor()
                                  : "bg-zinc-200 dark:bg-zinc-700",
                              )}
                            />
                          ))}
                        </div>

                        {/* Validation checklist */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="flex items-center gap-1.5">
                            {hasMinChars ? (
                              <CheckIcon
                                size={12}
                                className="h-3 w-3 text-green-500 flex-shrink-0"
                              />
                            ) : (
                              <XIcon size={12} className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                            )}
                            <span
                              className={cn(
                                "text-xs",
                                hasMinChars
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-zinc-400",
                              )}
                            >
                              6+ characters
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {hasUpper ? (
                              <CheckIcon
                                size={12}
                                className="h-3 w-3 text-green-500 flex-shrink-0"
                              />
                            ) : (
                              <XIcon size={12} className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                            )}
                            <span
                              className={cn(
                                "text-xs",
                                hasUpper ? "text-green-600 dark:text-green-400" : "text-zinc-400",
                              )}
                            >
                              Uppercase
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {hasNumber ? (
                              <CheckIcon
                                size={12}
                                className="h-3 w-3 text-green-500 flex-shrink-0"
                              />
                            ) : (
                              <XIcon size={12} className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                            )}
                            <span
                              className={cn(
                                "text-xs",
                                hasNumber ? "text-green-600 dark:text-green-400" : "text-zinc-400",
                              )}
                            >
                              Number
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-xs font-medium",
                                getStrengthLabel() === "Strong"
                                  ? "text-green-500"
                                  : getStrengthLabel() === "Medium"
                                    ? "text-yellow-500"
                                    : "text-zinc-400",
                              )}
                            >
                              {getStrengthLabel() && `${getStrengthLabel()} password`}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>

                  <motion.div variants={itemVariants} className="space-y-2">
                    <Label>Confirm Password</Label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      disabled={isLoading}
                      autoComplete="new-password"
                      className={cn(
                        "bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-700 focus:border-lime-400 dark:focus:border-emerald-500 transition-all",
                        confirmPassword && password !== confirmPassword
                          ? "border-red-300 dark:border-red-800 focus:ring-red-400 focus:border-red-400"
                          : "",
                      )}
                    />
                    {/* div (not p): the animated Check/X icons render a <div>, so a
                    <p> wrapper would produce a hydration error. */}
                    {confirmPassword && password !== confirmPassword && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-red-500 flex items-center gap-1"
                      >
                        <XIcon size={12} className="h-3 w-3" /> Passwords do not match
                      </motion.div>
                    )}
                    {confirmPassword && password === confirmPassword && password.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-green-500 flex items-center gap-1"
                      >
                        <CheckIcon size={12} className="h-3 w-3" /> Passwords match
                      </motion.div>
                    )}
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <ShimmerButton
                      type="submit"
                      className="w-full h-11 text-sm font-medium"
                      disabled={
                        !name || !email || !password || password !== confirmPassword || isLoading
                      }
                      shimmerColor="rgba(132, 204, 22, 0.5)"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" /> Create Account
                        </>
                      )}
                    </ShimmerButton>
                  </motion.div>
                </motion.form>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55, duration: 0.4 }}
                  className="mt-6 text-center text-sm text-zinc-500"
                >
                  Already have an account?{" "}
                  <Link
                    href="/en/login"
                    className="text-lime-600 hover:text-lime-500 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors"
                  >
                    Sign in
                  </Link>
                </motion.p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
