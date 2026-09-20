"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  CheckIcon,
  XIcon,
  CheckCheckIcon,
  EyeIcon,
  EyeOffIcon,
  CopyIcon,
  MailCheckIcon,
  ShieldCheckIcon,
} from "lucide-animated";
import {
  UserCircle,
  Camera,
  X,
  Save,
  Trash2,
  AlertTriangle,
  Loader2,
  Shield,
  ShieldOff,
  Smartphone,
  Mail,
  Timer,
  Scan,
  KeyRound,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/sora-ui/base/alert-dialog";
import { SecuritySettings } from "@/components/security-settings";
import { ActivityHeatmapCard } from "@/components/profile/activity-heatmap-card";
import { CoverCropDialog } from "@/components/cover-crop-dialog";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
import { PasswordStrength } from "@/components/ui/password-strength";
import { CodeSlots } from "@/components/ui/code-slots";
import { useAuth } from "@/hooks/use-auth";
import { useResendCooldown } from "@/components/security/use-resend-cooldown";
import { cn } from "@/lib/utils";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  avatar: string | null;
  coverImage?: string | null;
  role: string;
  totpEnabled: boolean;
  totpVerifiedAt: string | null;
  /** True when MFA is enrolled but unverified for 30+ days (re-verify alert). */
  mfaReverificationDue?: boolean;
  emailVerified: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const tprofile = useTranslations("profile");
  const tcommon = useTranslations("common");
  const tauth = useTranslations("auth");
  const locale = useLocale();
  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Profile form
  const [form, setForm] = useState({ name: "", email: "", phone: "", position: "" });
  // hasChanges is derived via useMemo below

  // Password form
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete account
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

  // Cover banner
  const coverInputRef = useRef<HTMLInputElement>(null);
  /** Pending cover image (data URL) awaiting the crop-dialog save. */
  const [coverCropSrc, setCoverCropSrc] = useState<string | null>(null);

  // 2FA
  const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [settingUp2FA, setSettingUp2FA] = useState(false);
  const [disable2FADialog, setDisable2FADialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disabling2FA, setDisabling2FA] = useState(false);
  // 30-day MFA freshness re-verification
  const [reVerifyDialogOpen, setReVerifyDialogOpen] = useState(false);
  const [reVerifyCode, setReVerifyCode] = useState("");
  // CodeSlots rejection states — see the component's drain/reset contract.
  const [totpRejected, setTotpRejected] = useState(false);
  const [reVerifyRejected, setReVerifyRejected] = useState(false);
  const [reVerifying, setReVerifying] = useState(false);
  const [showDisablePassword, setShowDisablePassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  // Deep link from Settings → Security toggle (?setup2fa=1 / ?disable2fa=1):
  // auto-open the matching dialog once. window.location keeps this safe during
  // static prerender (no Suspense-bound searchParams hook needed).
  const twoFaDeepLinkHandled = useRef(false);
  const handleSetup2FARef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (twoFaDeepLinkHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup2fa")) {
      twoFaDeepLinkHandled.current = true;
      handleSetup2FARef.current?.();
    } else if (params.get("disable2fa")) {
      twoFaDeepLinkHandled.current = true;
      setDisable2FADialog(true);
    }
  }, []);

  // Email verification
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [copied, setCopied] = useState(false);
  // Shared 60s resend cooldown (persisted in localStorage) — the same key the
  // Security Center card uses, so a send from either surface blocks resends.
  const { cooldownLeft, startCooldown } = useResendCooldown();

  // Load profile data — non-OK responses reject with a specific toast; JSON
  // parse failures (poisoned .next cache, proxy HTML) retry once, since a
  // transient compile window is the usual cause.
  useEffect(() => {
    let cancelled = false;
    const load = (attempt: number): Promise<void> =>
      fetch("/api/profile")
        .then(async (r) => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${r.status}`);
          }
          return r.json();
        })
        .then((data) => {
          if (cancelled) return;
          setProfile(data);
          setForm({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            position: data.position || "",
          });
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt < 1) {
            // One retry — most failures are a transient dev-compile window.
            setTimeout(() => void load(attempt + 1), 1500);
            return;
          }
          setLoading(false);
          toast.error(tprofile("failedToLoad"));
        });
    void load(0);
    return () => {
      cancelled = true;
    };
  }, []);

  // Check for email verified query param (?verified=true after a successful
  // confirm-link click, ?verified=invalid when the token was bad/expired).
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const verified = params.get("verified");
      if (verified === "true") {
        toast.success(tprofile("emailVerifiedSuccess"));
        // Refresh profile data
        fetch("/api/profile")
          .then((r) => r.json())
          .then((data) =>
            setProfile((prev) => (prev ? { ...prev, emailVerified: data.emailVerified } : null)),
          );
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
      } else if (verified === "invalid") {
        toast.error(tprofile("emailVerifyLinkInvalid"));
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track form changes (derived state)
  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      form.name !== (profile.name || "") ||
      form.email !== (profile.email || "") ||
      form.phone !== (profile.phone || "") ||
      form.position !== (profile.position || "")
    );
  }, [form, profile]);

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || tprofile("failedToLoad"));
      }
      const updated = await res.json();
      setProfile((prev) => (prev ? { ...prev, ...updated } : null));
      toast.success(tprofile("saved"));
      // await updateSession(); // Refresh via context or page reload
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "image/svg+xml") {
      toast.error(tprofile("selectImageFile"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(tprofile("imageTooLarge"));
      return;
    }

    // Direct upload for SVG to preserve crisp scalable vector markup
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === "string") {
          await handleAvatarCropSave(reader.result);
        }
      };
      reader.onerror = () => toast.error(tprofile("failedReadImage"));
      reader.readAsDataURL(file);
      return;
    }

    // Read the file, then open the crop dialog — the photo is only uploaded
    // after the user confirms the crop.
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.onerror = () => toast.error(tprofile("failedReadImage"));
    reader.readAsDataURL(file);
  };

  const handleAvatarCropSave = async (croppedDataUrl: string): Promise<boolean> => {
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: croppedDataUrl }),
      });
      if (!res.ok) throw new Error(tprofile("failedUploadAvatar"));
      const updated = await res.json();
      setProfile((prev) => (prev ? { ...prev, avatar: updated.avatar } : null));
      updateUser({ avatar: updated.avatar });
      toast.success(tprofile("photoUpdated"));
      return true;
    } catch (err: any) {
      toast.error(err.message);
      return false;
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirm = useConfirm();

  // Cover upload — stored on User.coverImage; null resets to the
  // appearance-accent default. Images are downscaled client-side to keep the
  // base64 payload inside the 10MB budget.
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(tprofile("failedUploadAvatar")));
        reader.readAsDataURL(file);
      });
      // Open the 4:1 crop dialog — the user frames the banner; the dialog's
      // save handler (uploadCroppedCover) does the upload.
      setCoverCropSrc(dataUrl);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const uploadCroppedCover = async (dataUrl: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImage: dataUrl }),
      });
      if (!res.ok) throw new Error(tprofile("failedUploadAvatar"));
      const updated = await res.json();
      setProfile((prev) => (prev ? { ...prev, coverImage: updated.coverImage } : null));
      toast.success(tprofile("coverUpdated"));
      return true;
    } catch (err: any) {
      toast.error(err.message);
      return false;
    }
  };

  const handleRemoveCover = async () => {
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImage: null }),
      });
      if (!res.ok) throw new Error(tprofile("failedRemoveAvatar"));
      setProfile((prev) => (prev ? { ...prev, coverImage: null } : null));
      toast.success(tprofile("coverRemoved"));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveAvatar = async () => {
    const ok = await confirm({
      description: tprofile("removePhotoConfirm"),
      confirmLabel: tcommon("delete"),
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error(tprofile("failedRemoveAvatar"));
      setProfile((prev) => (prev ? { ...prev, avatar: null } : null));
      updateUser({ avatar: null });
      toast.success(tprofile("photoRemoved"));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      toast.error(tprofile("fillPasswordFields"));
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error(tprofile("passwordsDontMatch"));
      return;
    }
    if (passwordForm.new.length < 8) {
      toast.error(tprofile("passwordMinLength"));
      return;
    }
    if (passwordForm.current === passwordForm.new) {
      toast.error(tprofile("passwordDifferent"));
      return;
    }

    setChangingPassword(true);
    try {
      // Step-up: re-authenticate with the current password before this
      // sensitive action (unlocks a short-lived step-up cookie server-side).
      const stepUp = await fetch("/api/auth/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "change_password", password: passwordForm.current }),
      });
      if (!stepUp.ok) {
        // 428 = the 30-day MFA freshness gate: a stale 2FA user must re-prove
        // the second factor before ANY sensitive action. Channel them into the
        // re-verify dialog instead of letting this attempt fail dead-end.
        if (stepUp.status === 428) {
          toast.error(tprofile("mfaReverifyDue"));
          setReVerifyCode("");
          setReVerifyDialogOpen(true);
          return;
        }
        throw new Error(tprofile("currentPasswordWrong"));
      }
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || tprofile("failedChangePassword"));
      }
      toast.success(tprofile("passwordChanged"));
      setPasswordForm({ current: "", new: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error(tprofile("enterPasswordToast"));
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || tprofile("failedToLoad"));
      }
      toast.success(tprofile("accountDeleted"));
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // === 2FA Handlers ===

  const handleSetup2FA = async () => {
    setSettingUp2FA(true);
    try {
      const res = await fetch("/api/auth/totp/setup");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || tprofile("failedToLoad"));
      }
      const data = await res.json();
      setQrCode(data.qrCode);
      setTotpSecret(data.secret);
      setTotpCode("");
      setTwoFADialogOpen(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSettingUp2FA(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!totpCode || totpCode.length < 6) {
      toast.error(tprofile("enterValidCode"));
      return;
    }

    setVerifying2FA(true);
    try {
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: totpCode, secret: totpSecret }),
      });

      if (!res.ok) {
        const err = await res.json();
        setTotpRejected(true);
        throw new Error(err.error || tprofile("invalidCodeToast"));
      }

      toast.success(tprofile("twoFAEnabledToast"));
      setTwoFADialogOpen(false);
      setProfile((prev) =>
        prev ? { ...prev, totpEnabled: true, totpVerifiedAt: new Date().toISOString() } : null,
      );
      setQrCode("");
      setTotpSecret("");
      setTotpCode("");
    } catch (err: any) {
      setTotpRejected(true);
      toast.error(err.message);
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast.error(tprofile("enterPasswordToast"));
      return;
    }

    setDisabling2FA(true);
    try {
      const res = await fetch("/api/auth/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || tprofile("failedDisable2FA"));
      }

      toast.success(tprofile("twoFADisabledToast"));
      setDisable2FADialog(false);
      setDisablePassword("");
      setProfile((prev) => (prev ? { ...prev, totpEnabled: false, totpVerifiedAt: null } : null));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDisabling2FA(false);
    }
  };

  // === 30-day MFA freshness re-verification ===

  const handleReVerify2FA = async () => {
    if (!reVerifyCode || reVerifyCode.length < 6) {
      toast.error(tprofile("enterValidCode"));
      return;
    }
    setReVerifying(true);
    try {
      const res = await fetch("/api/auth/totp/re-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: reVerifyCode }),
      });
      if (!res.ok) {
        const err = await res.json();
        setReVerifyRejected(true);
        throw new Error(err.error || tprofile("invalidCodeToast"));
      }
      // Freshness reset: the server recorded MFA_VERIFIED, so the alert
      // clears immediately without a reload.
      setProfile((prev) => (prev ? { ...prev, mfaReverificationDue: false } : null));
      setReVerifyDialogOpen(false);
      setReVerifyCode("");
      toast.success(tprofile("mfaReverifySuccess"));
    } catch (err: any) {
      setReVerifyRejected(true);
      toast.error(err.message);
    } finally {
      setReVerifying(false);
    }
  };

  // Keep the deep-link effect's handler reference current across renders.
  useEffect(() => {
    handleSetup2FARef.current = handleSetup2FA;
  });

  // === Email Verification Handlers ===

  const handleSendVerification = async () => {
    setSendingVerification(true);
    try {
      const res = await fetch("/api/auth/verify-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `from: "profile"` is forwarded into the confirm link so the post-
        // confirm redirect lands back on the profile page.
        body: JSON.stringify({ locale, from: "profile" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || tprofile("failedToLoad"));
      }
      const data = await res.json();
      if (data.alreadyVerified) {
        // Account already verified — refresh the status and show a success.
        toast.success(tprofile("emailVerifiedSuccess"));
        fetch("/api/profile")
          .then((r) => r.json())
          .then((d) =>
            setProfile((prev) => (prev ? { ...prev, emailVerified: d.emailVerified } : null)),
          )
          .catch(() => {});
      } else {
        setVerificationUrl(data.verificationUrl);
        startCooldown();
        toast.success(tprofile("verificationSent"));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingVerification(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(tprofile("linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tprofile("failedCopy"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tprofile("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{tprofile("subtitle")}</p>
      </div>

      {/* Identity card — wide, with custom cover (defaults to the appearance accent) */}
      <Card className="overflow-hidden">
        {/* Cover banner — custom upload wins, appearance-accent gradient is the default.
            Kept short (h-32/h-36) so the banner reads as a backdrop, not a
            wall of image that crowds the identity row below it. */}
        <div className="relative h-32 sm:h-36">
          {profile?.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.coverImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <>
              <div className="absolute inset-0 avatar-brand" />
              <div
                className="absolute inset-0 opacity-[0.18] [background-size:16px_16px]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
                }}
              />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
          {/* Cover actions */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleCoverUpload}
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-7 gap-1.5 text-xs bg-black/35 hover:bg-black/50 text-white border-white/20 backdrop-blur"
              onClick={() => coverInputRef.current?.click()}
            >
              <Camera className="h-3.5 w-3.5" /> {tprofile("coverUpload")}
            </Button>
            {profile?.coverImage && (
              <Button
                variant="secondary"
                size="sm"
                aria-label={tprofile("coverRemove")}
                className="h-7 gap-1.5 text-xs bg-black/35 hover:bg-black/50 text-white border-white/20 backdrop-blur"
                onClick={handleRemoveCover}
              >
                <X className="h-3.5 w-3.5" /> {tprofile("coverRemove")}
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-6 pt-0">
          {/* Identity row: ONLY the avatar overlaps the cover (its own -mt),
              so the name/role/email block and the member-since/2FA rail
              always sit fully below the banner with clear space on every
              width — the text can never be covered by the cover image. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative group shrink-0 self-start sm:self-auto -mt-10 sm:-mt-12">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-white dark:ring-gray-900 shadow-xl">
                <AvatarImage
                  src={profile?.avatar || user?.avatar || (user as any)?.picture || ""}
                  alt={profile?.name || ""}
                  className="object-cover"
                />
                <AvatarFallback className="text-3xl avatar-brand font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {avatarUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif,image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            {/* Name / role / email block — fills the wide card, always
                below the cover edge (no negative margin here). */}
            <div className="min-w-0 flex-1 pt-1 sm:pt-2 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {profile?.name || tprofile("userFallback")}
                </h3>
                {profile?.emailVerified ? (
                  <span className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[11px] font-semibold">
                    <CheckCheckIcon size={12} className="h-3 w-3" />
                    {tprofile("verified")}
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">
                    <Mail className="h-3 w-3" />
                    {tprofile("unverified")}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 capitalize mt-0.5">
                {profile?.role?.toLowerCase() || tprofile("staffFallback")}
                <span className="mx-1.5" aria-hidden>
                  ·
                </span>
                <span className="normal-case" title={profile?.email || ""}>
                  {profile?.email || "-"}
                </span>
              </p>

              {profile?.avatar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  className="mt-1 text-xs text-gray-400 hover:text-red-500"
                >
                  <XIcon size={14} className="h-3.5 w-3.5 mr-1" /> {tprofile("removePhoto")}
                </Button>
              )}
            </div>

            {/* Status summary — right rail on desktop, below the cover */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-8 gap-y-2 pt-1 sm:pt-2 sm:pb-1 w-full sm:w-auto">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400">
                  {tprofile("memberSince")}
                </p>
                <p className="text-sm font-medium">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "-"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400">
                  {tprofile("twoFA")}
                </p>
                <p
                  className={`text-sm font-medium ${profile?.totpEnabled ? "text-green-600" : "text-gray-400"}`}
                >
                  {profile?.totpEnabled ? tprofile("enabled") : tprofile("disabled")}
                </p>
              </div>
            </div>
          </div>

          {/* Activity heatmap — real engagement over the trailing year */}
          <div className="mt-6">
            <ActivityHeatmapCard />
          </div>
        </CardContent>
      </Card>

      {/* Main Content — two-column settings grid on desktop; the identity
            card (cover/photo/heatmap) and security surfaces stay full-width. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Personal Information */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              <CardTitle>{tprofile("personalInfo")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tprofile("name")}
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={tprofile("namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tprofile("email")}
                </label>
                <Input
                  type="email"
                  value={form.email}
                  disabled
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={tprofile("emailPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tprofile("phone")}
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder={tprofile("phonePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tprofile("position")}
                </label>
                <Input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder={tprofile("positionPlaceholder")}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {hasChanges && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {tprofile("unsavedChanges")}
                </p>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {hasChanges && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (profile)
                        setForm({
                          name: profile.name || "",
                          email: profile.email || "",
                          phone: profile.phone || "",
                          position: profile.position || "",
                        });
                    }}
                  >
                    {tprofile("reset")}
                  </Button>
                )}
                <Button onClick={handleSaveProfile} disabled={!hasChanges || saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tcommon("save")}...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" /> {tprofile("saveChanges")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Verification */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {profile?.emailVerified ? (
                <MailCheckIcon size={20} className="h-5 w-5 text-green-600" />
              ) : (
                <Mail className="h-5 w-5" />
              )}
              <CardTitle>{tprofile("emailVerification")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {profile?.emailVerified ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                <CheckIcon size={20} className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    {tprofile("emailVerified")}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {tprofile("verifiedOn", {
                      date: new Date(profile.emailVerified).toLocaleDateString(),
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      {tprofile("emailNotVerified")}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {tprofile("verifyPrompt")}
                    </p>
                  </div>
                </div>

                {verificationUrl ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {tprofile("verificationLink")}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 text-xs bg-gray-50 dark:bg-gray-800 border rounded-lg truncate">
                        {verificationUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(verificationUrl)}
                      >
                        {copied ? (
                          <CheckCheckIcon size={16} className="h-4 w-4 text-green-600" />
                        ) : (
                          <CopyIcon size={16} className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">{tprofile("verificationNote")}</p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleSendVerification}
                    disabled={sendingVerification || cooldownLeft > 0}
                  >
                    {sendingVerification ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tprofile("sending")}
                      </>
                    ) : cooldownLeft > 0 ? (
                      <>
                        <Timer className="h-4 w-4 mr-2" />{" "}
                        {tprofile("resendInSeconds", { seconds: cooldownLeft })}
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />{" "}
                        {verificationUrl ? tprofile("resendEmail") : tprofile("sendVerification")}
                      </>
                    )}
                  </Button>
                  {cooldownLeft > 0 && (
                    <p className="text-xs text-gray-500">
                      {tprofile("emailResendNote", { seconds: cooldownLeft })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card id="two-factor">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {profile?.totpEnabled ? (
                  <ShieldCheckIcon size={20} className="h-5 w-5 text-green-600" />
                ) : (
                  <Shield className="h-5 w-5" />
                )}
                <CardTitle>{tprofile("twoFATitle")}</CardTitle>
              </div>
              {/* Toggle reflects current 2FA state — auto-ON when active.
                    Turning on starts setup; turning off opens the disable dialog. */}
              <Switch
                checked={!!profile?.totpEnabled}
                disabled={settingUp2FA}
                onCheckedChange={(next) => {
                  if (next) handleSetup2FA();
                  else setDisable2FADialog(true);
                }}
                aria-label={tprofile("twoFATitle")}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.totpEnabled ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                  <ShieldCheckIcon size={20} className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">
                        {tprofile("twoFAActive")}
                      </p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[11px] font-semibold">
                        <CheckCheckIcon size={12} className="h-3 w-3" />
                        {tprofile("verified")}
                      </span>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      {profile?.totpVerifiedAt
                        ? tprofile("verifiedOn", {
                            date: new Date(profile.totpVerifiedAt).toLocaleDateString(),
                          })
                        : tprofile("twoFAActiveDesc")}
                    </p>
                    {profile?.mfaReverificationDue && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700">
                        <AlertTriangle size={16} className="h-4 w-4 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300 flex-1 min-w-[12rem]">
                          {tprofile("mfaReverifyDue")}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => {
                            setReVerifyCode("");
                            setReVerifyDialogOpen(true);
                          }}
                        >
                          {tprofile("mfaReverifyNow")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setDisable2FADialog(true)}>
                  <ShieldOff className="h-4 w-4 mr-2" /> {tprofile("disable2FA")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  <Smartphone className="h-5 w-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {tprofile("enhanceSecurity")}
                    </p>
                    <p className="text-xs text-gray-500">{tprofile("enhanceSecurityDesc")}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={handleSetup2FA} disabled={settingUp2FA}>
                  {settingUp2FA ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tprofile("preparing")}
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-4 w-4 mr-2" /> {tprofile("setup2FA")}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            {" "}
            <CardTitle>{tprofile("changePassword")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {" "}
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tprofile("currentPassword")}
              </label>
              <div className="relative">
                <Input
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  placeholder={tprofile("currentPasswordPlaceholder")}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswords({ ...showPasswords, current: !showPasswords.current })
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? (
                    <EyeOffIcon size={16} className="h-4 w-4" />
                  ) : (
                    <EyeIcon size={16} className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tprofile("newPassword")}
                </label>
                <div className="relative">
                  <Input
                    type={showPasswords.new ? "text" : "password"}
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    placeholder={tprofile("newPasswordPlaceholder")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? (
                      <EyeOffIcon size={16} className="h-4 w-4" />
                    ) : (
                      <EyeIcon size={16} className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {passwordForm.new && (
                  <>
                    <PasswordStrength password={passwordForm.new} />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {tauth("strengthHint")}
                    </p>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tprofile("confirmPassword")}
                </label>
                <div className="relative">
                  <Input
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    placeholder={tprofile("confirmPasswordPlaceholder")}
                    className={cn(
                      "pr-10",
                      passwordForm.confirm &&
                        passwordForm.new !== passwordForm.confirm &&
                        "border-red-400 focus:ring-red-400",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? (
                      <EyeOffIcon size={16} className="h-4 w-4" />
                    ) : (
                      <EyeIcon size={16} className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {passwordForm.confirm && passwordForm.new !== passwordForm.confirm && (
                  <p className="text-xs text-red-500 mt-1">{tprofile("passwordsDoNotMatch")}</p>
                )}
                {passwordForm.confirm && passwordForm.new === passwordForm.confirm && (
                  <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <CheckIcon size={12} className="h-3 w-3" /> {tprofile("passwordsMatch")}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleChangePassword}
                disabled={
                  !passwordForm.current ||
                  !passwordForm.new ||
                  !passwordForm.confirm ||
                  passwordForm.new !== passwordForm.confirm ||
                  changingPassword
                }
                variant="outline"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tprofile("changing")}
                  </>
                ) : (
                  tprofile("changePasswordBtn")
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security: sessions, backup codes, activity */}
        {/* Security + Danger Zone — full-width rows under the two-column
              settings grid */}
        <div className="xl:col-span-2 space-y-6">
          <SecuritySettings />

          {/* Danger Zone - Delete Account */}
          <Card className="border-red-200 dark:border-red-900/50">
            <CardHeader>
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-red-600 dark:text-red-400">
                  {tprofile("dangerZone")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {tprofile("dangerZoneDesc")}
              </p>
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {tprofile("deleteAccount")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Avatar Crop Dialog (keyed by image so each new photo starts with a fresh crop/zoom) */}
      <AvatarCropDialog
        key={cropImageSrc || "avatar-crop-closed"}
        open={cropDialogOpen}
        imageSrc={cropImageSrc || ""}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setCropImageSrc(null);
        }}
        onSave={handleAvatarCropSave}
      />

      {/* Cover crop — 4:1 banner framing before upload (key resets state) */}
      <CoverCropDialog
        key={coverCropSrc || "cover-crop-closed"}
        open={!!coverCropSrc}
        imageSrc={coverCropSrc || ""}
        onOpenChange={(open) => {
          if (!open) setCoverCropSrc(null);
        }}
        onSave={uploadCroppedCover}
      />

      {/* 2FA Setup Dialog — same layout as Security → Two-Factor Authentication */}
      <Dialog
        open={twoFADialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTwoFADialogOpen(false);
            setQrCode("");
            setTotpSecret("");
            setTotpCode("");
          }
        }}
      >
        <DialogContent className="max-w-[480px] p-0 overflow-hidden backdrop-blur-sm bg-background/95 border-border shadow-2xl">
          <DialogHeader className="p-5 sm:p-6 pb-2">
            <DialogTitle className="flex items-center text-xl font-medium">
              {tprofile("setup2FATitle")}
            </DialogTitle>
            <DialogDescription className="hidden">{tprofile("setup2FADesc")}</DialogDescription>
          </DialogHeader>

          <div className="px-5 sm:px-6 space-y-6 pb-4">
            {/* Scan QR Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-base font-medium">
                <Scan className="w-5 h-5" />
                {tprofile("scanQrTitle")}
              </div>
              <p className="text-sm text-muted-foreground">{tprofile("setup2FADesc")}</p>

              <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-xl bg-card/50">
                {qrCode && (
                  <div className="bg-white p-1 rounded-lg shrink-0 w-32 h-32 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="TOTP QR Code" className="w-full h-full" />
                  </div>
                )}
                {totpSecret && (
                  <div className="flex flex-col justify-center space-y-3 w-full">
                    <p className="text-sm font-medium">{tprofile("manualEntry")}</p>
                    <div className="bg-background border rounded-md px-3 py-2">
                      <code className="text-xs font-mono tracking-widest text-center block">
                        {totpSecret.match(/.{1,4}/g)?.join(" ")}
                        <span className="sr-only">{totpSecret}</span>
                      </code>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-fit h-8"
                      onClick={() => {
                        navigator.clipboard.writeText(totpSecret);
                        toast.success(tprofile("secretCopiedToast"));
                      }}
                    >
                      <CopyIcon size={14} className="w-3.5 h-3.5 mr-2" /> {tprofile("copySecret")}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Verification Code Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-base font-medium">
                <KeyRound className="w-5 h-5" />
                {tprofile("verifyCodeLabel")}
              </div>
              <p className="text-sm text-muted-foreground">{tprofile("verifyCodeHint")}</p>

              <CodeSlots
                value={totpCode}
                onChange={(code) => {
                  setTotpCode(code);
                  if (code.length === 0 && totpRejected) setTotpRejected(false);
                }}
                status={totpRejected ? "error" : "idle"}
                disabled={verifying2FA}
                autoFocus
                ariaLabel={tprofile("verifyCodeLabel")}
                slotSize={48}
                gap={6}
                className="max-w-sm"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/30 border-t flex sm:justify-between items-center w-full gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setTwoFADialogOpen(false);
                setQrCode("");
                setTotpSecret("");
                setTotpCode("");
              }}
              disabled={verifying2FA}
            >
              {tcommon("cancel")}
            </Button>
            <Button
              onClick={handleVerify2FA}
              disabled={totpCode.length < 6 || verifying2FA}
              className="bg-primary hover:bg-primary/90 text-primary-foreground border-0"
            >
              {verifying2FA ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tprofile("verifying")}
                </>
              ) : (
                tprofile("enable2FA")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      {/* 2FA Re-verification Dialog — 30-day freshness check */}
      <Dialog
        open={reVerifyDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setReVerifyDialogOpen(false);
            setReVerifyCode("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-primary" />
              {tprofile("mfaReverifyTitle")}
            </DialogTitle>
            <DialogDescription>{tprofile("mfaReverifyDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <CodeSlots
                value={reVerifyCode}
                onChange={(code) => {
                  setReVerifyCode(code);
                  if (code.length === 0 && reVerifyRejected) setReVerifyRejected(false);
                }}
                status={reVerifyRejected ? "error" : "idle"}
                disabled={reVerifying}
                autoFocus
                ariaLabel={tprofile("mfaReverifyTitle")}
                slotSize={48}
                gap={6}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReVerifyDialogOpen(false)}>
                {tcommon("cancel")}
              </Button>
              <Button onClick={handleReVerify2FA} disabled={reVerifying || reVerifyCode.length < 6}>
                {reVerifying ? tcommon("loading") : tprofile("mfaReverifyNow")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={disable2FADialog}
        onOpenChange={(open) => {
          if (!open) {
            setDisable2FADialog(false);
            setDisablePassword("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {tprofile("disabledesc")}
            </DialogTitle>
            <DialogDescription>{tprofile("disable2FADesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>{tprofile("warning")}:</strong> {tprofile("disable2FAWarning")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tprofile("enterPassword")}
              </label>
              <div className="relative">
                <Input
                  type={showDisablePassword ? "text" : "password"}
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder={tprofile("yourCurrentPassword")}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowDisablePassword(!showDisablePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showDisablePassword ? (
                    <EyeOffIcon size={16} className="h-4 w-4" />
                  ) : (
                    <EyeIcon size={16} className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDisable2FADialog(false);
                setDisablePassword("");
              }}
            >
              {tcommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable2FA}
              disabled={!disablePassword || disabling2FA}
            >
              {disabling2FA ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tprofile("disabling")}
                </>
              ) : (
                tprofile("disable2FA")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation — Sora alert-dialog (3D rise, media tile) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>{tprofile("deleteAccount")}</AlertDialogTitle>
            <AlertDialogDescription>{tprofile("deleteAccountDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>{tprofile("warning")}:</strong> {tprofile("deleteAccountWarning")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tprofile("enterPasswordConfirm")}
              </label>
              <div className="relative">
                <Input
                  type={showDeletePassword ? "text" : "password"}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder={tprofile("yourCurrentPassword")}
                  className="pr-10 border-red-300 dark:border-red-700 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showDeletePassword ? (
                    <EyeOffIcon size={16} className="h-4 w-4" />
                  ) : (
                    <EyeIcon size={16} className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletePassword("");
              }}
            >
              {tcommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={!deletePassword || deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tprofile("deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" /> {tprofile("deleteAccount")}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
