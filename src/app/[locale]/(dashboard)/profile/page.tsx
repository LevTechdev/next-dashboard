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
  Save,
  Trash2,
  AlertTriangle,
  Loader2,
  Shield,
  ShieldOff,
  Smartphone,
  Mail,
  Timer,
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
import { SecuritySettings } from "@/components/security-settings";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
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
  role: string;
  totpEnabled: boolean;
  totpVerifiedAt: string | null;
  emailVerified: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const tprofile = useTranslations("profile");
  const tcommon = useTranslations("common");
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

  // Email verification
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [copied, setCopied] = useState(false);
  // Shared 60s resend cooldown (persisted in localStorage) — the same key the
  // Security Center card uses, so a send from either surface blocks resends.
  const { cooldownLeft, startCooldown } = useResendCooldown();

  // Load profile data
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
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
        setLoading(false);
        toast.error(tprofile("failedToLoad"));
      });
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
    if (!file.type.startsWith("image/")) {
      toast.error(tprofile("selectImageFile"));
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error(tprofile("imageTooLarge"));
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Card */}
        <Card className="lg:sticky lg:top-24 h-fit overflow-hidden">
          {/* Cover banner — brand-tinted image background */}
          <div className="relative h-28">
            <div className="absolute inset-0 avatar-brand" />
            <div
              className="absolute inset-0 opacity-[0.18] [background-size:16px_16px]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
          </div>
          <CardContent className="p-6 pt-0 flex flex-col items-center text-center">
            <div className="relative -mt-14 mb-4 group">
              <Avatar className="h-28 w-28 ring-4 ring-white dark:ring-gray-900 shadow-xl">
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
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <h3 className="text-lg font-semibold">{profile?.name || tprofile("userFallback")}</h3>
            <p className="text-sm text-gray-500 capitalize">
              {profile?.role?.toLowerCase() || tprofile("staffFallback")}
            </p>

            {/* Email + verification status badge */}
            <div className="mt-2 flex flex-col items-center gap-1.5 min-w-0 max-w-full">
              <div className="flex items-center gap-2 min-w-0 max-w-full">
                <p
                  className="text-sm text-gray-600 dark:text-gray-300 truncate"
                  title={profile?.email || ""}
                >
                  {profile?.email || "-"}
                </p>
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
              {profile?.emailVerified ? (
                <p className="text-[11px] text-gray-400">
                  {tprofile("verifiedOn", {
                    date: new Date(profile.emailVerified).toLocaleDateString(),
                  })}
                </p>
              ) : null}
            </div>

            {profile?.avatar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveAvatar}
                className="mt-2 text-xs text-gray-400 hover:text-red-500"
              >
                <XIcon size={12} className="h-3 w-3 mr-1" /> {tprofile("removePhoto")}
              </Button>
            )}

            <div className="mt-4 pt-4 border-t w-full space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tprofile("memberSince")}</span>
                <span className="font-medium">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tprofile("role")}</span>
                <span className="font-medium capitalize">
                  {profile?.role?.toLowerCase() || "-"}
                </span>
              </div>

              {/* Email Verification Status */}
              <div className="flex justify-between text-sm items-center pt-2 border-t">
                <span className="text-gray-500">{tprofile("emailStatus")}</span>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${profile?.emailVerified ? "text-green-600" : "text-amber-600"}`}
                >
                  {profile?.emailVerified ? (
                    <>
                      <MailCheckIcon size={14} className="h-3.5 w-3.5" /> {tprofile("verified")}
                    </>
                  ) : (
                    <>
                      <Mail className="h-3.5 w-3.5" /> {tprofile("unverified")}
                    </>
                  )}
                </span>
              </div>

              {/* 2FA Status */}
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-500">{tprofile("twoFA")}</span>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${profile?.totpEnabled ? "text-green-600" : "text-gray-400"}`}
                >
                  {profile?.totpEnabled ? (
                    <>
                      <ShieldCheckIcon size={14} className="h-3.5 w-3.5" /> {tprofile("enabled")}
                    </>
                  ) : (
                    <>
                      <ShieldOff className="h-3.5 w-3.5" /> {tprofile("disabled")}
                    </>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
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
          <Card>
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
                      onClick={() =>
                        setShowPasswords({ ...showPasswords, new: !showPasswords.new })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.new ? (
                        <EyeOffIcon size={16} className="h-4 w-4" />
                      ) : (
                        <EyeIcon size={16} className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {tprofile("confirmPassword")}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordForm.confirm}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirm: e.target.value })
                      }
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
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> {tprofile("deleteAccount")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Avatar Crop Dialog (keyed by image so each new photo starts with a fresh crop/zoom) */}
      <AvatarCropDialog
        key={cropImageSrc || "closed"}
        open={cropDialogOpen}
        imageSrc={cropImageSrc || ""}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setCropImageSrc(null);
        }}
        onSave={handleAvatarCropSave}
      />

      {/* 2FA Setup Dialog */}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-indigo-600" />
              {tprofile("setup2FATitle")}
            </DialogTitle>
            <DialogDescription>{tprofile("setup2FADesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* QR Code */}
            {qrCode && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="TOTP QR Code"
                  className="w-48 h-48 rounded-lg border-2 border-gray-200 dark:border-gray-700"
                />
              </div>
            )}

            {/* Manual setup key */}
            {totpSecret && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 text-center">{tprofile("manualEntry")}</p>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 border">
                  <code className="flex-1 text-center text-sm font-mono tracking-wider">
                    {totpSecret.match(/.{1,4}/g)?.join(" ")}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(totpSecret);
                      toast.success(tprofile("secretCopiedToast"));
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {" "}
                    <CopyIcon size={16} className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Verification code input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center block">
                {tprofile("verifyCodeLabel")}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-12 text-center text-xl tracking-[0.5em] font-mono"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setTwoFADialogOpen(false);
                setQrCode("");
                setTotpSecret("");
                setTotpCode("");
              }}
            >
              {tcommon("cancel")}
            </Button>
            <Button onClick={handleVerify2FA} disabled={totpCode.length < 6 || verifying2FA}>
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
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder={tprofile("yourCurrentPassword")}
              />
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

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {tprofile("deleteAccount")}
            </DialogTitle>
            <DialogDescription>{tprofile("deleteAccountDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>{tprofile("warning")}:</strong> {tprofile("deleteAccountWarning")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tprofile("enterPasswordConfirm")}
              </label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder={tprofile("yourCurrentPassword")}
                className="border-red-300 dark:border-red-700 focus:ring-red-500"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletePassword("");
              }}
            >
              {tcommon("cancel")}
            </Button>
            <Button
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
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
