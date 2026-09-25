"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoaderCircleIcon } from "lucide-animated";
import {
  Fingerprint,
  Building2,
  Eye,
  EyeOff,
  Timer,
  SmartphoneIcon,
  MailIcon,
  ChevronRightIcon,
  KeyRoundIcon,
  AlertTriangle,
  CheckIcon,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthTestimonial } from "@/components/auth/auth-testimonial";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeSlots } from "@/components/ui/code-slots";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggleButton } from "@/components/theme/theme-toggle-button";
import {
  FORGOT_PASSWORD_COOLDOWN_KEY,
  useResendCooldown,
} from "@/components/security/use-resend-cooldown";
import { useAuth } from "@/hooks/use-auth";
import { backupCodeStatus } from "@/lib/backup-code-status";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

/**
 * "Trust this device for 30 days" — the opt-in that lets a device the user
 * vouches for skip the second factor.
 *
 * It reads as ONE control: a bordered row with a shield mark, a checkbox that
 * fills with the tenant accent, and a one-line hint. Before this it was a bare
 * native checkbox floating next to two lines of grey text, which read as an
 * afterthought on every one of the four second-factor steps.
 */
function TrustDeviceToggle({
  checked,
  onChange,
  label,
  hint,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer select-none items-start gap-3 rounded-xl border p-3 transition-colors",
        checked
          ? "border-primary/50 bg-primary/5"
          : "border-zinc-200 bg-white/60 hover:border-primary/40 dark:border-zinc-800 dark:bg-zinc-900/60",
        className,
      )}
    >
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-zinc-300 bg-white transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 dark:border-zinc-600 dark:bg-zinc-800"
        />
        <CheckIcon
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute h-3 w-3 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100"
        />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          {label}
        </span>
        <span className="mt-1 block text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
          {hint}
        </span>
      </span>
    </label>
  );
}

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
  // True once the browser proves it can run a WebAuthn ceremony
  // (`navigator.credentials`). Rendering the passwordless button only after
  // this keeps SSR markup stable — the button is client-only by design, so
  // first paint never includes it and hydration can't disagree.
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  useEffect(() => {
    setPasskeyAvailable(
      typeof window !== "undefined" &&
        !!window.PublicKeyCredential &&
        typeof window.PublicKeyCredential === "function",
    );
  }, []);

  const [totpCode, setTotpCode] = useState("");
  // Drives the CodeSlots error treatment: true while the rejected code drains,
  // cleared by the component's own reset (onChange("") after the drain) so the
  // row returns to the idle treatment ready for the next attempt.
  const [totpRejected, setTotpRejected] = useState(false);
  // ── Verification-method chooser (2FA step) ──
  // `null` = the default TOTP prompt (unchanged behaviour); "choose" = the
  // picker between authenticator app and an emailed code; "email" = the
  // emailed-OTP entry step (CodeSlots + resend); "backup_code" = the recovery
  // path for a lost authenticator (one of the saved single-use codes).
  const [verifyMethod, setVerifyMethod] = useState<
    null | "choose" | "email_otp" | "backup_code" | "recover_access"
  >(null);
  const [, setEmailOtpSent] = useState(false);
  const [emailOtpDevCode, setEmailOtpDevCode] = useState<string | null>(null);
  const [emailOtpHint, setEmailOtpHint] = useState<string | null>(null);
  // Recovery path: the xxxx-xxxx code typed into the backup-code step.
  const [backupCodeInput, setBackupCodeInput] = useState("");
  const [backupRejected, setBackupRejected] = useState(false);
  // Last resort: neither the authenticator nor any backup code is available, so
  // the user requests an emailed link that disables 2FA (account recovery).
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryDevUrl, setRecoveryDevUrl] = useState<string | null>(null);
  const [savedEmail, setSavedEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  // Whether the account has registered passkeys — revealed by the first
  // requires-2FA response and used to render the chooser's passkey card.
  const [hasPasskeys, setHasPasskeys] = useState(false);
  // "Trust this device for 30 days" — granted only while completing a second
  // factor; the server skips 2FA for the TTL on the matching device profile.
  const [trustDevice, setTrustDevice] = useState(false);
  // "Stay signed in" — stamps a durable 7-day grant on this device's
  // refresh-token family so the session survives the browser closing. Unlike
  // device trust it never skips 2FA; the dashboard stay-login sentinel just
  // goes dormant while the grant is live.
  const [staySignedIn, setStaySignedIn] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || `/${locale}/dashboard`;
  const sessionNotice = searchParams.get("reason");

  // A dead session force-closes the dashboard onto this form with
  // ?reason=expired (or reason=session-changed when another tab signed in as a
  // different account). Say why, so the reappearing login form doesn't read as
  // a random ejection.
  useEffect(() => {
    if (sessionNotice !== "expired" && sessionNotice !== "session-changed") return;
    toast.info(sessionNotice === "expired" ? t("sessionExpired") : t("sessionChanged"), {
      id: "session-notice",
    });
  }, [sessionNotice, t]);

  // Returning from a failed account-recovery link (?recovery=invalid|expired):
  // the confirm route could not consume the token, so say why and offer a new
  // link instead of dumping the user on a silent login form.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const recovery = params.get("recovery");
    // `alert=invalid` is where the security-alert revoke link lands when the
    // token was expired, already used, or bogus. `alert=reset_required` is the
    // SSO callback saying the account is paused pending a new password.
    const alert = params.get("alert");
    if (
      recovery !== "invalid" &&
      recovery !== "expired" &&
      alert !== "invalid" &&
      alert !== "reset_required"
    ) {
      return;
    }
    if (alert === "reset_required") {
      // The SSO callback refused an account that a "this wasn't me" revoke
      // paused: the only way forward is a new password, so open the reset
      // request instead of leaving them on a form that cannot succeed.
      toast.error(t("passwordResetRequired"));
      router.replace(`/${locale}/forgot-password`);
    } else {
      toast.error(
        recovery === "expired"
          ? t("recoveryExpired")
          : recovery === "invalid"
            ? t("recoveryInvalid")
            : t("alertLinkInvalid"),
      );
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [t, router, locale]);

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
      const result = await login(
        email,
        password,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        staySignedIn,
      );
      if (result.requires2FA) {
        setSavedEmail(email);
        setSavedPassword(password);
        setTotpRequired(true);
        // Fresh challenge → always land on the method chooser.
        setVerifyMethod("choose");
        setHasPasskeys(result.hasPasskeys ?? false);
        setEmailOtpSent(false);
        setEmailOtpDevCode(null);
        setEmailOtpHint(null);
        setBackupCodeInput("");
        setBackupRejected(false);
        setTrustDevice(false);
        setIsLoading(false);
        return;
      }
      if (result.success) {
        toast.success(t("welcomeBackToast"));
        router.push(redirect);
      } else if (result.error === "PASSWORD_RESET_REQUIRED") {
        // The account was secured by the alert email's "this wasn't me" link.
        // Sign-in stays closed until the password is replaced, so send the user
        // straight to the reset request rather than leaving them on a form that
        // cannot succeed.
        toast.error(t("passwordResetRequired"));
        setForgotSent(false);
        setForgotDevUrl(null);
        setView("forgot");
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

  /**
   * Latched the moment the second factor is ACCEPTED.
   *
   * Every second-factor handler below ends the same way: on success it toasts,
   * pushes to the dashboard, and releases `totpSubmittingRef` in its `finally` —
   * while the redirect is still in flight. The code field also auto-submits the
   * moment six digits land, so an impatient click on top of it produced a SECOND
   * request with a code the server had already spent.
   *
   * That second request is now refused (RFC 6238 §5.2 replay guard, and backup
   * codes were always single-use), which turned a real defect into a visible one:
   * a successful sign-in could show "That code was already used" next to
   * "Welcome back!". Once the factor is accepted there is nothing left to
   * submit, so every handler bows out instead.
   */
  const secondFactorSettledRef = useRef(false);

  /** True while a second-factor request is in flight or already accepted. */
  const secondFactorLocked = () => secondFactorSettledRef.current || totpSubmittingRef.current;

  /** Send (or re-send) the email login challenge and switch to its entry step. */
  const requestEmailOtp = async () => {
    setIsLoading(true);
    try {
      const result = await login(savedEmail, savedPassword, undefined, undefined, true);
      if (result.requires2FA) {
        setEmailOtpSent(true);
        setVerifyMethod("email_otp");
        setEmailOtpDevCode(result.devOtp ?? null);
        setEmailOtpHint(null);
        setTotpCode("");
        setTotpRejected(false);
        // Delivered, or durably queued for delivery after this response — both
        // mean the code is on its way (see lib/email-outbox). A misconfigured
        // server mailer is the one case where saying "check your inbox" would
        // be a lie.
        if (result.mailMisconfigured) toast.error(t("emailDeliveryMisconfigured"));
        else if (result.emailSent || result.emailQueued) toast.success(t("emailOtpSentToast"));
        else toast.success(t("developmentOtp"));
      } else {
        toast.error(result.error || t("errorGeneric"));
      }
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setIsLoading(false);
    }
  };

  /** Submit the emailed-OTP step (same session grant as the TOTP path). */
  const handleEmailOtpVerification = async (code: string) => {
    if (code.length < 6) {
      toast.error(t("invalidCodeLength"));
      return;
    }
    if (secondFactorLocked()) return;
    totpSubmittingRef.current = true;
    setIsLoading(true);
    try {
      const result = await login(
        savedEmail,
        savedPassword,
        undefined,
        code,
        undefined,
        undefined,
        trustDevice,
      );
      if (result.success) {
        secondFactorSettledRef.current = true;
        toast.success(t("welcomeBackToast"));
        router.push(redirect);
      } else {
        setTotpRejected(true);
        setEmailOtpHint(
          result.attemptsLeft !== undefined
            ? t("otpIncorrectAttempts").replace("{attempts}", String(result.attemptsLeft))
            : result.error === "OTP_EXPIRED"
              ? t("otpExpired")
              : result.error === "OTP_TOO_MANY_ATTEMPTS"
                ? t("otpTooManyAttempts")
                : null,
        );
        toast.error(
          result.error === "OTP_INVALID" ? t("invalidCode") : result.error || t("invalidCode"),
        );
      }
    } catch {
      setTotpRejected(true);
      toast.error(t("errorGeneric"));
    } finally {
      // A settled sign-in keeps the spinner: the redirect is in flight, and a
      // re-enabled button is what invited the second submit in the first place.
      if (!secondFactorSettledRef.current) {
        totpSubmittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  /**
   * Recovery path for a lost authenticator: submit one of the single-use
   * backup codes as the second factor. The server consumes it on success, so a
   * replayed code is rejected — the E2E spec pins that.
   */
  const handleBackupCodeVerification = async (code: string) => {
    const clean = code.trim().toLowerCase();
    if (clean.replace(/-/g, "").length < 8) {
      toast.error(t("invalidBackupCodeLength"));
      return;
    }
    if (secondFactorLocked()) return;
    totpSubmittingRef.current = true;
    setIsLoading(true);
    try {
      const result = await login(
        savedEmail,
        savedPassword,
        undefined,
        undefined,
        undefined,
        undefined,
        trustDevice,
        clean,
      );
      if (result.success) {
        secondFactorSettledRef.current = true;
        toast.success(t("welcomeBackToast"));
        // Recovery codes are finite and each sign-in burns one. Say so while
        // the user is still on the recovery step — it is the last moment the
        // count is in front of them.
        const status = backupCodeStatus(result.backupCodesRemaining);
        if (status === "exhausted") {
          toast.warning(t("backupCodeExhaustedToast"), { duration: 12_000 });
        } else if (status === "low") {
          toast.warning(t("backupCodeLowToast", { count: result.backupCodesRemaining ?? 0 }), {
            duration: 12_000,
          });
        }
        router.push(redirect);
      } else {
        setBackupRejected(true);
        toast.error(t("backupCodeInvalid"));
      }
    } catch {
      setBackupRejected(true);
      toast.error(t("errorGeneric"));
    } finally {
      if (!secondFactorSettledRef.current) {
        totpSubmittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  const handleTotpVerification = async (code: string) => {
    if (code.length < 6) {
      toast.error(t("invalidCodeLength"));
      return;
    }
    if (secondFactorLocked()) return;
    totpSubmittingRef.current = true;
    setIsLoading(true);
    try {
      const result = await login(
        savedEmail,
        savedPassword,
        code,
        undefined,
        undefined,
        undefined,
        trustDevice,
      );
      if (result.success) {
        secondFactorSettledRef.current = true;
        toast.success(t("welcomeBackToast"));
        router.push(redirect);
      } else {
        setTotpRejected(true);
        // A replayed code is a different problem from a wrong one: the same
        // digits will keep failing for the rest of their 30-second step, so
        // tell the user to wait for the next code instead of inviting a retry.
        toast.error(
          result.code === "TOTP_REPLAY" ? t("codeAlreadyUsed") : result.error || t("invalidCode"),
        );
      }
    } catch {
      setTotpRejected(true);
      toast.error(t("errorGeneric"));
    } finally {
      if (!secondFactorSettledRef.current) {
        totpSubmittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  /**
   * Passkey as the second factor: run the WebAuthn ceremony in second-factor
   * mode (the endpoint verifies the assertion but issues no session), then
   * complete the login with the marker it set. The password step already
   * happened, so this only satisfies the second factor.
   */
  const handlePasskeySecondFactor = async () => {
    if (secondFactorLocked()) return;
    totpSubmittingRef.current = true;
    setIsLoading(true);
    try {
      const optionsRes = await fetch("/api/auth/webauthn/authenticate/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: savedEmail }),
      });
      if (!optionsRes.ok) {
        const data = await optionsRes.json().catch(() => null);
        toast.error(data?.error || t("loginFailed"));
        return;
      }
      const options = await optionsRes.json();
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: assertion, mode: "second_factor" }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => null);
        toast.error(data?.error || t("loginFailed"));
        return;
      }
      const result = await login(
        savedEmail,
        savedPassword,
        undefined,
        undefined,
        undefined,
        true,
        trustDevice,
      );
      if (result.success) {
        // The marker cookie is single-use, so a second completion would fail
        // with a bare "login failed" on a sign-in that already worked.
        secondFactorSettledRef.current = true;
        toast.success(t("welcomeBackToast"));
        router.push(redirect);
      } else {
        toast.error(result.error || t("loginFailed"));
      }
    } catch {
      // User dismissed the browser's passkey prompt — not a failure toast.
    } finally {
      if (!secondFactorSettledRef.current) {
        totpSubmittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  /**
   * Last resort: no authenticator and no backup code left. Request the emailed
   * recovery link. The server requires the password again (already verified on
   * this step) so owning the inbox alone can't start a recovery.
   */
  const requestAccountRecovery = async () => {
    if (recoveryLoading) return;
    setRecoveryLoading(true);
    try {
      const res = await fetch("/api/auth/account-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: savedEmail || email,
          password: savedPassword || password,
          locale,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("errorGeneric"));
        return;
      }
      setRecoverySent(true);
      // Dev/E2E only: with no mailer configured the API returns the link.
      setRecoveryDevUrl(typeof data?.recoveryUrl === "string" ? data.recoveryUrl : null);
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setRecoveryLoading(false);
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

  // Passkey login: run the WebAuthn ceremony WITHOUT an email — the options
  // step omits allowCredentials, so the authenticator offers discoverable
  // credentials and the user picks one. The verify endpoint resolves the
  // account from the asserted credential and sets the session cookies
  // exactly like a password login. True passwordless, zero prelude.
  const handlePasskeyLogin = async () => {
    try {
      const optionsRes = await fetch("/api/auth/webauthn/authenticate/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoverable: true }),
      });
      const options = await optionsRes.json();
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: assertion }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => null);
        toast.error(data?.error || t("loginFailed"));
        return;
      }
      toast.success(t("welcomeBackToast"));
      router.push(redirect);
      router.refresh();
    } catch {
      // User cancelled the authenticator prompt or the ceremony failed.
      toast.error(t("loginFailed"));
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-primary dark:bg-zinc-950 p-4 sm:p-8 transition-colors duration-300">
      {mounted && (
        <ThemeToggleButton
          className="absolute top-4 right-4 sm:top-8 sm:right-8 p-3 rounded-full bg-white dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 backdrop-blur-md text-zinc-900 dark:text-white shadow-sm z-50"
          iconClassName="h-5 w-5"
          side="bottom"
        />
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
                {verifyMethod === "choose" ? (
                  <>
                    <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                      {t("chooseVerifyTitle")}
                    </h1>
                    <p className="text-sm text-zinc-500 mb-8">{t("chooseVerifyDesc")}</p>

                    <div className="space-y-3">
                      {/* Authenticator app — the default second factor */}
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyMethod(null);
                          setTotpCode("");
                          setTotpRejected(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 text-left transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer group"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <SmartphoneIcon className="h-5 w-5" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                            {t("useAuthenticator")}
                          </span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {t("useAuthenticatorDesc")}
                          </span>
                        </span>
                        <ChevronRightIcon className="h-4 w-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>

                      {/* Emailed code — same account, different channel */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => void requestEmailOtp()}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 text-left transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer group disabled:opacity-60 disabled:pointer-events-none"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {isLoading ? (
                            <LoaderCircleIcon className="h-5 w-5 shrink-0 animate-spin" />
                          ) : (
                            <MailIcon className="h-5 w-5" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                            {t("useEmailCode")}
                          </span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {t("useEmailCodeDesc")}
                          </span>
                        </span>
                        <ChevronRightIcon className="h-4 w-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>

                      {/* Backup code — the recovery path when the authenticator
                          device (and its app) is gone for good. */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          setVerifyMethod("backup_code");
                          setBackupCodeInput("");
                          setBackupRejected(false);
                          setTotpCode("");
                          setTotpRejected(false);
                          setEmailOtpHint(null);
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 text-left transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer group disabled:opacity-60 disabled:pointer-events-none"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <KeyRoundIcon className="h-5 w-5" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                            {t("useBackupCode")}
                          </span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {t("useBackupCodeDesc")}
                          </span>
                        </span>
                        <ChevronRightIcon className="h-4 w-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>

                      {/* Passkey — phishing-resistant, offered when registered */}
                      {hasPasskeys && (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => void handlePasskeySecondFactor()}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 text-left transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer group disabled:opacity-60 disabled:pointer-events-none"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {isLoading ? (
                              <LoaderCircleIcon className="h-5 w-5 shrink-0 animate-spin" />
                            ) : (
                              <Fingerprint className="h-5 w-5" />
                            )}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                              {t("usePasskey")}
                            </span>
                            <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              {t("usePasskeyDesc")}
                            </span>
                          </span>
                          <ChevronRightIcon className="h-4 w-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      )}
                    </div>

                    <TrustDeviceToggle
                      className="mt-5"
                      checked={trustDevice}
                      onChange={setTrustDevice}
                      label={t("trustDeviceLabel")}
                      hint={t("trustDeviceHint")}
                    />

                    {/* Everything lost — offer the last resort from the chooser
                        too, before the user gives up on the account. */}
                    <button
                      type="button"
                      onClick={() => {
                        setVerifyMethod("recover_access");
                        setRecoverySent(false);
                        setRecoveryDevUrl(null);
                      }}
                      className="mt-5 w-full text-sm text-primary hover:underline transition-colors"
                    >
                      {t("lostAllMethods")}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTotpRequired(false);
                        setVerifyMethod(null);
                        setTotpCode("");
                      }}
                      className="mt-4 w-full text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    >
                      {t("backToLogin")}
                    </button>
                  </>
                ) : verifyMethod === "email_otp" ? (
                  <>
                    <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                      {t("emailOtpTitle")}
                    </h1>
                    <p className="text-sm text-zinc-500 mb-8">
                      {t("emailOtpDesc", { email: savedEmail })}
                    </p>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleEmailOtpVerification(totpCode);
                      }}
                      className="space-y-6"
                    >
                      <div className="space-y-2">
                        <Label className="text-zinc-700">{t("verificationCode")}</Label>
                        <div className="flex w-full justify-center pt-1">
                          <CodeSlots
                            value={totpCode}
                            onChange={(code) => {
                              setTotpCode(code);
                              if (code.length === 0) {
                                setTotpRejected(false);
                                setEmailOtpHint(null);
                              }
                            }}
                            onComplete={(code) => {
                              void handleEmailOtpVerification(code);
                            }}
                            status={totpRejected ? "error" : "idle"}
                            disabled={isLoading}
                            autoFocus
                            ariaLabel={t("verificationCode")}
                            slotSize={48}
                            gap={6}
                          />
                        </div>
                        {emailOtpDevCode && (
                          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2.5 text-center">
                            <p className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                              {t("developmentOtp")}
                            </p>
                            <p className="font-mono text-lg font-bold tracking-[0.3em] text-zinc-800 dark:text-zinc-100">
                              {emailOtpDevCode}
                            </p>
                          </div>
                        )}
                        {emailOtpHint && (
                          <p className="text-xs text-destructive text-center">{emailOtpHint}</p>
                        )}
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-12 text-sm font-medium text-primary-foreground bg-accent-gradient rounded-xl shadow-lg shadow-primary/20"
                        disabled={totpCode.length < 6 || isLoading}
                      >
                        {isLoading ? (
                          <>
                            <LoaderCircleIcon
                              size={16}
                              className="mr-2 h-4 w-4 shrink-0 animate-spin"
                            />{" "}
                            {t("verifying")}
                          </>
                        ) : (
                          t("verifyAndLogin")
                        )}
                      </Button>
                    </form>

                    <TrustDeviceToggle
                      className="mt-4"
                      checked={trustDevice}
                      onChange={setTrustDevice}
                      label={t("trustDeviceLabel")}
                      hint={t("trustDeviceHint")}
                    />

                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => void requestEmailOtp()}
                        className="w-full text-sm text-primary hover:underline transition-colors disabled:opacity-60"
                      >
                        {t("resendEmailCode")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyMethod("choose");
                          setTotpCode("");
                          setTotpRejected(false);
                          setEmailOtpHint(null);
                        }}
                        className="w-full text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                      >
                        ← {t("chooseOtherMethod")}
                      </button>
                    </div>
                  </>
                ) : verifyMethod === "backup_code" ? (
                  <>
                    <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                      {t("backupCodeTitle")}
                    </h1>
                    <p className="text-sm text-zinc-500 mb-8">{t("backupCodeDesc")}</p>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleBackupCodeVerification(backupCodeInput);
                      }}
                      className="space-y-6"
                    >
                      <div className="space-y-2">
                        <Label className="text-zinc-700">{t("backupCodeLabel")}</Label>
                        {/* Same CodeSlots control as the 2FA step — eight
                            alphanumeric slots grouped xxxx-xxxx. A recovery
                            code is a second factor too, so it should feel like
                            the same lock rather than a plain text box. */}
                        <div className="flex w-full justify-center pt-1">
                          <CodeSlots
                            length={8}
                            alphabet="alphanumeric"
                            groupSize={4}
                            value={backupCodeInput}
                            onChange={(code) => {
                              setBackupCodeInput(code);
                              if (code.length === 0 && backupRejected) setBackupRejected(false);
                            }}
                            onComplete={(code) => {
                              void handleBackupCodeVerification(code);
                            }}
                            status={backupRejected ? "error" : "idle"}
                            disabled={isLoading}
                            autoFocus
                            ariaLabel={t("backupCodeLabel")}
                            placeholder={t("backupCodePlaceholder")}
                            slotSize={34}
                            gap={5}
                            radius={10}
                          />
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t("backupCodeSingleUse")}
                        </p>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-12 text-sm font-medium text-primary-foreground bg-accent-gradient rounded-xl shadow-lg shadow-primary/20"
                        disabled={backupCodeInput.replace(/-/g, "").length < 8 || isLoading}
                      >
                        {isLoading ? (
                          <>
                            <LoaderCircleIcon
                              size={16}
                              className="mr-2 h-4 w-4 shrink-0 animate-spin"
                            />{" "}
                            {t("verifying")}
                          </>
                        ) : (
                          t("verifyAndLogin")
                        )}
                      </Button>

                      <TrustDeviceToggle
                        checked={trustDevice}
                        onChange={setTrustDevice}
                        label={t("trustDeviceLabel")}
                        hint={t("trustDeviceHint")}
                      />

                      {/* Dead end: no authenticator AND no codes left. */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          setVerifyMethod("recover_access");
                          setRecoverySent(false);
                          setRecoveryDevUrl(null);
                        }}
                        className="w-full text-sm text-primary hover:underline transition-colors disabled:opacity-60"
                      >
                        {t("lostAllMethods")}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setVerifyMethod("choose");
                          setBackupCodeInput("");
                          setBackupRejected(false);
                        }}
                        className="w-full text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                      >
                        ← {t("chooseOtherMethod")}
                      </button>
                    </form>
                  </>
                ) : verifyMethod === "recover_access" ? (
                  <>
                    <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                      {recoverySent ? t("recoveryLinkSent") : t("accountRecoveryTitle")}
                    </h1>
                    <p className="text-sm text-zinc-500 mb-8">
                      {recoverySent
                        ? t("recoveryLinkSentDesc", { email: savedEmail || email })
                        : t("accountRecoveryDesc")}
                    </p>

                    {recoverySent ? (
                      <div className="space-y-6">
                        {recoveryDevUrl && (
                          <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 p-3">
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                              {t("developmentRecoveryLink")}
                            </p>
                            <Link
                              href={recoveryDevUrl}
                              className="mt-1 block break-all text-xs text-primary underline"
                            >
                              {recoveryDevUrl}
                            </Link>
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-11 rounded-xl"
                          onClick={() => void requestAccountRecovery()}
                          disabled={recoveryLoading}
                        >
                          {recoveryLoading ? t("verifying") : t("resendRecoveryLink")}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs leading-snug text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{t("accountRecoveryWarning")}</span>
                        </div>

                        <Button
                          type="button"
                          className="w-full h-12 text-sm font-medium text-primary-foreground bg-accent-gradient rounded-xl shadow-lg shadow-primary/20"
                          onClick={() => void requestAccountRecovery()}
                          disabled={recoveryLoading}
                        >
                          {recoveryLoading ? (
                            <>
                              <LoaderCircleIcon
                                size={16}
                                className="mr-2 h-4 w-4 shrink-0 animate-spin"
                              />{" "}
                              {t("verifying")}
                            </>
                          ) : (
                            t("sendRecoveryLink")
                          )}
                        </Button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setVerifyMethod("choose");
                        setRecoverySent(false);
                        setRecoveryDevUrl(null);
                      }}
                      className="mt-6 w-full text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    >
                      {t("chooseOtherMethod")}
                    </button>
                  </>
                ) : (
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
                        {/* CodeSlots: six animated slots, a gliding caret, and the
                        real verification state — a rejected code drains the row
                        and flashes the destructive treatment, an accepted one
                        washes it with the accent before the redirect. */}
                        <div className="flex w-full justify-center pt-1">
                          <CodeSlots
                            value={totpCode}
                            onChange={(code) => {
                              setTotpCode(code);
                              if (code.length === 0 && totpRejected) setTotpRejected(false);
                            }}
                            onComplete={(code) => {
                              void handleTotpVerification(code);
                            }}
                            status={totpRejected ? "error" : "idle"}
                            disabled={isLoading}
                            autoFocus
                            ariaLabel={t("verificationCode")}
                            slotSize={48}
                            gap={6}
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
                            <LoaderCircleIcon
                              size={16}
                              className="mr-2 h-4 w-4 shrink-0 animate-spin"
                            />{" "}
                            {t("verifying")}
                          </>
                        ) : (
                          t("verifyAndLogin")
                        )}
                      </Button>

                      <TrustDeviceToggle
                        checked={trustDevice}
                        onChange={setTrustDevice}
                        label={t("trustDeviceLabel")}
                        hint={t("trustDeviceHint")}
                      />

                      {/* Lost the device (or wiped the app)? The saved
                          single-use backup codes are the way back in. */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          setVerifyMethod("backup_code");
                          setBackupCodeInput("");
                          setBackupRejected(false);
                          setTotpCode("");
                          setTotpRejected(false);
                        }}
                        className="w-full text-sm text-primary hover:underline transition-colors disabled:opacity-60"
                      >
                        {t("lostAuthenticator")}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTotpRequired(false);
                          setVerifyMethod(null);
                          setTotpCode("");
                        }}
                        className="w-full text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                      >
                        {t("backToLogin")}
                      </button>
                    </form>
                  </>
                )}
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
                          <LoaderCircleIcon
                            size={16}
                            className="mr-2 h-4 w-4 shrink-0 animate-spin"
                          />
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

                {/* Persistent counterpart to the session toast: a dead session
                    force-closed the dashboard onto this form, and the banner
                    stays until it is dismissed by navigation — the toast alone
                    vanished too fast to read (and gave e2e nothing to assert). */}
                {(sessionNotice === "expired" || sessionNotice === "session-changed") && (
                  <div
                    id="session-expired-notice"
                    data-testid="session-expired-notice"
                    role="alert"
                    className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    <Timer className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      {sessionNotice === "expired" ? t("sessionExpired") : t("sessionChanged")}
                    </span>
                  </div>
                )}

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

                  <TrustDeviceToggle
                    className="mt-5"
                    checked={staySignedIn}
                    onChange={setStaySignedIn}
                    label={t("staySignedInLabel")}
                    hint={t("staySignedInHint")}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 text-sm font-medium text-primary-foreground bg-accent-gradient rounded-xl shadow-lg shadow-primary/20 mt-2"
                    disabled={!email || !password || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <LoaderCircleIcon
                          size={16}
                          className="mr-2 h-4 w-4 shrink-0 animate-spin"
                        />{" "}
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
                  {passkeyAvailable && (
                    <button
                      onClick={() => void handlePasskeyLogin()}
                      type="button"
                      aria-label={t("passkeySignIn")}
                      title={t("passkeyAnyAccount")}
                      className="flex-1 h-12 border border-zinc-200 rounded-xl flex items-center justify-center hover:bg-zinc-50 transition-colors"
                    >
                      <Fingerprint className="h-5 w-5 text-zinc-700" />
                    </button>
                  )}
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
          <LoaderCircleIcon
            size={32}
            className="h-8 w-8 shrink-0 animate-spin text-primary-foreground"
          />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
