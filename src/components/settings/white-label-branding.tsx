"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Palette,
  Sparkles,
  ImagePlus,
  SwatchBook,
  ShieldCheck,
  Save,
  Loader2,
  FileText,
  Building,
  RefreshCw,
  Upload,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAppearance } from "@/hooks/use-appearance";
import { LOGO_LIBRARY, logoEntryToDataUrl, logoLibraryIdFromUrl } from "@/lib/logo-icon-library";

const THEME_PRESETS = [
  { key: "presetIndigo", hex: "#4f46e5", bg: "bg-indigo-600" },
  { key: "presetEmerald", hex: "#059669", bg: "bg-emerald-600" },
  { key: "presetRose", hex: "#e11d48", bg: "bg-rose-600" },
  { key: "presetAmber", hex: "#d97706", bg: "bg-amber-600" },
  { key: "presetViolet", hex: "#7c3aed", bg: "bg-purple-600" },
  { key: "presetSky", hex: "#0284c7", bg: "bg-sky-600" },
];

export function WhiteLabelBranding() {
  const t = useTranslations("branding");
  const tcommon = useTranslations("common");
  const { settings: appearanceSettings } = useAppearance();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");

  const [branding, setBranding] = useState({
    brandName: "Next Dashboard Enterprise",
    customDomain: "dashboard.company.com",
    domainStatus: "VERIFIED" as "VERIFIED" | "PENDING_DNS" | "FAILED",
    cnameTarget: "cname.next-dashboard.com",
    sslActive: true,
    logoUrl: "/icon",
    faviconUrl: "/icon",
    primaryColor: "#4f46e5",
    accentColor: "#06b6d4",
    invoiceHeaderNote: "Thank you for your business. Please remit payment within terms.",
    invoiceFooterNote: "Registered Enterprise Inc. • Tax ID / NPWP: 01.234.567.8-901.000",
    invoiceAddress: "Pacific Edge Tower, Level 24, Jakarta 10220, Indonesia",
    taxId: "01.234.567.8-901.000",
    emailDigestSubject: "Executive Weekly Digest & KPI Report",
  });

  const fetchBranding = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tenant/branding");
      if (res.ok) {
        const data = await res.json();
        if (data.branding) {
          setBranding(data.branding);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const handleCopyCname = () => {
    navigator.clipboard.writeText(branding.cnameTarget);
    setCopied(true);
    toast.success(t("cnameCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyDomain = async () => {
    try {
      setVerifying(true);
      const res = await fetch("/api/tenant/domain-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: branding.customDomain }),
      });

      const data = await res.json();
      if (res.ok) {
        setBranding((prev) => ({
          ...prev,
          domainStatus: data.status,
          sslActive: data.sslActive,
        }));
        toast.success(data.message || t("dnsVerified"));
      } else {
        toast.error(data.message || t("dnsFailed"));
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch("/api/tenant/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });

      if (res.ok) {
        toast.success(t("brandingSaved"));
      } else {
        toast.error(tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectColor = (hex: string) => {
    setBranding((prev) => ({ ...prev, primaryColor: hex }));
    document.documentElement.style.setProperty("--primary", hex);
  };

  const applyImportedLogo = (logoUrl: string) => {
    setBranding((prev) => ({ ...prev, logoUrl }));
    toast.success(t("logoImported"));
  };

  const handleLogoUpload = async (file: File) => {
    setImporting(true);
    try {
      const res = await fetch("/api/branding/logo", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: await file.text(),
      });
      const data = (await res.json().catch(() => null)) as {
        logoUrl?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.logoUrl) {
        toast.error(data?.error ?? t("logoImportFailed"));
        return;
      }
      applyImportedLogo(data.logoUrl);
    } catch {
      toast.error(t("logoImportFailed"));
    } finally {
      setImporting(false);
    }
  };

  const handleLogoImportUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    try {
      const res = await fetch("/api/branding/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json().catch(() => null)) as {
        logoUrl?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.logoUrl) {
        toast.error(data?.error ?? t("logoImportFailed"));
        return;
      }
      setUrlDialogOpen(false);
      setImportUrl("");
      applyImportedLogo(data.logoUrl);
    } catch {
      toast.error(t("logoImportFailed"));
    } finally {
      setImporting(false);
    }
  };

  const ACCENT_HEX_MAP: Record<string, string> = {
    default: "#0ea5e9",
    green: "#059669",
    indigo: "#4f46e5",
    rose: "#e11d48",
    amber: "#d97706",
  };

  const handleSyncDashboardTheme = () => {
    let activeHex = "#0ea5e9";
    if (appearanceSettings?.accent === "custom" && appearanceSettings.customColor) {
      activeHex = appearanceSettings.customColor;
    } else if (appearanceSettings?.accent && ACCENT_HEX_MAP[appearanceSettings.accent]) {
      activeHex = ACCENT_HEX_MAP[appearanceSettings.accent];
    }
    handleSelectColor(activeHex);
    toast.success(t("syncWithTheme"));
  };

  if (loading) {
    return (
      <Card className="border-gray-200 dark:border-gray-800">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">{t("brandingTitle")}</CardTitle>
            <CardDescription className="text-xs">{t("brandingSubtitle")}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          {/* Custom Domain Section */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {t("customDomain")}
                </span>
              </div>
              {branding.domainStatus === "VERIFIED" ? (
                <Badge variant="success" className="gap-1 font-semibold">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("dnsVerified")}
                </Badge>
              ) : (
                <Badge variant="warning" className="gap-1 font-semibold">
                  <AlertCircle className="h-3 w-3" />
                  {t("dnsPending")}
                </Badge>
              )}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {t("customDomainDesc")}
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  value={branding.customDomain}
                  onChange={(e) => setBranding({ ...branding, customDomain: e.target.value })}
                  placeholder={t("customDomainPlaceholder")}
                  className="font-mono text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleVerifyDomain}
                disabled={verifying}
                className="shrink-0 gap-1.5 text-xs font-semibold h-9 px-3.5"
              >
                {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("verifyDns")}
              </Button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {t("cnameLabel")}
                </span>
                <code className="font-mono text-primary font-semibold">{branding.cnameTarget}</code>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyCname}
                className="h-8 px-2.5 text-xs gap-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-gray-500" />
                )}
                <span>{copied ? t("copied") : t("copy")}</span>
              </Button>
            </div>
          </div>

          {/* Brand Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                {t("brandName")}
              </label>
              <Input
                value={branding.brandName}
                onChange={(e) => setBranding({ ...branding, brandName: e.target.value })}
                placeholder={t("brandNamePlaceholder")}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                {t("logoUrl")}
              </label>
              <div className="flex gap-2 items-center">
                <Input
                  value={branding.logoUrl}
                  onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                  placeholder={t("logoUrlPlaceholder")}
                  className="text-xs font-mono"
                />
                <div className="h-9 w-9 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center justify-center bg-gray-50 dark:bg-gray-900 shrink-0 overflow-hidden">
                  {branding.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={branding.logoUrl}
                      alt="Logo preview"
                      className="h-6 w-6 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Building className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
              {/* Local icons library — one-click brand marks serialized to
                  self-contained data URLs (works offline, no upload needed). */}
              <div className="mt-2.5">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <ImagePlus className="h-3 w-3 text-primary" />
                  {t("logoLibraryLabel")}
                </p>
                {/* Upload + URL import — the API sanitizes SVG uploads
                    (script/foreignObject/event-handler stripping) and passes
                    data/remote URLs through with a size ceiling. */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[11px] font-medium gap-1.5"
                    disabled={importing}
                    onClick={() => document.getElementById("branding-logo-upload")?.click()}
                  >
                    {importing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    {t("logoUpload")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[11px] font-medium gap-1.5"
                    onClick={() => setUrlDialogOpen(true)}
                  >
                    <Link2 className="h-3 w-3" />
                    {t("logoImportUrl")}
                  </Button>
                  <input
                    id="branding-logo-upload"
                    type="file"
                    accept=".svg,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      void handleLogoUpload(file);
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LOGO_LIBRARY.map((entry) => {
                    const activeId = logoLibraryIdFromUrl(branding.logoUrl);
                    const isActive = activeId === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        title={entry.label}
                        aria-label={`${t("logoLibraryLabel")}: ${entry.label}`}
                        aria-pressed={isActive}
                        onClick={() =>
                          setBranding((prev) => ({
                            ...prev,
                            logoUrl: logoEntryToDataUrl(entry),
                          }))
                        }
                        className={cn(
                          "h-9 w-9 rounded-lg border flex items-center justify-center transition-all hover:scale-105",
                          isActive
                            ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                            : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50 dark:bg-gray-900",
                        )}
                      >
                        {entry.badge ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={logoEntryToDataUrl(entry)}
                            alt=""
                            className="h-6 w-6 rounded-full"
                          />
                        ) : (
                          <span
                            className="h-5 w-5 [&>svg]:h-full [&>svg]:w-full"
                            style={{ color: entry.color }}
                            dangerouslySetInnerHTML={{ __html: entry.svg }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* URL import dialog */}
          <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("logoImportUrl")}</DialogTitle>
                <DialogDescription>{t("logoImportUrlDesc")}</DialogDescription>
              </DialogHeader>
              <Input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder={t("logoImportUrlPlaceholder")}
                className="text-xs font-mono"
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUrlDialogOpen(false)}
                >
                  {tcommon("cancel")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!importUrl.trim() || importing}
                  onClick={() => void handleLogoImportUrl()}
                >
                  {importing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  {t("logoImportApply")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Theme Color Accents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <SwatchBook className="h-3.5 w-3.5 text-primary" />
                {t("themeColorAccent")}
              </label>
              <Tooltip side="bottom" content={t("syncWithTheme")}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSyncDashboardTheme}
                  className="h-7 px-2 text-[11px] font-medium text-primary hover:bg-primary/10 gap-1.5"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>{t("syncWithTheme")}</span>
                </Button>
              </Tooltip>
            </div>

            <div className="flex flex-wrap gap-2.5 items-center">
              {THEME_PRESETS.map((p) => {
                const isSelected = branding.primaryColor.toLowerCase() === p.hex.toLowerCase();
                return (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => handleSelectColor(p.hex)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary text-primary font-semibold"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300",
                    )}
                  >
                    <span className={cn("h-3 w-3 rounded-full shrink-0", p.bg)} />
                    <span>{t(p.key as any)}</span>
                  </button>
                );
              })}

              <div className="flex items-center gap-2 ml-auto p-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium pl-1">
                  {t("customColor")}
                </span>
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => handleSelectColor(e.target.value)}
                  className="h-7 w-7 rounded border border-gray-200 dark:border-gray-700 cursor-pointer bg-transparent"
                  aria-label={t("customColor")}
                />
              </div>
            </div>
          </div>

          {/* Invoice & Email Templates Customization */}
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-gray-100">
              <FileText className="h-3.5 w-3.5 text-primary" />
              {t("invoiceNotes")}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                {t("invoiceHeaderNote")}
              </label>
              <Input
                value={branding.invoiceHeaderNote}
                onChange={(e) => setBranding({ ...branding, invoiceHeaderNote: e.target.value })}
                placeholder={t("invoiceHeaderPlaceholder")}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                {t("invoiceFooterNote")}
              </label>
              <Input
                value={branding.invoiceFooterNote}
                onChange={(e) => setBranding({ ...branding, invoiceFooterNote: e.target.value })}
                placeholder={t("invoiceFooterPlaceholder")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  {t("taxId")}
                </label>
                <Input
                  value={branding.taxId}
                  onChange={(e) => setBranding({ ...branding, taxId: e.target.value })}
                  placeholder={t("taxIdPlaceholder")}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  {t("invoiceAddress")}
                </label>
                <Input
                  value={branding.invoiceAddress}
                  onChange={(e) => setBranding({ ...branding, invoiceAddress: e.target.value })}
                  placeholder={t("invoiceAddressPlaceholder")}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-semibold shadow-sm h-9 px-4"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? t("saving") : t("saveBranding")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
