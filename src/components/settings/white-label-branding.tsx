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
  ShieldCheck,
  Save,
  Loader2,
  FileText,
  Building,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppearance } from "@/hooks/use-appearance";

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
                <div className="h-9 w-9 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center justify-center bg-gray-50 dark:bg-gray-900 shrink-0">
                  <Building className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Theme Color Accents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t("themeColorAccent")}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSyncDashboardTheme}
                className="h-7 px-2 text-[11px] font-medium text-primary hover:bg-primary/10 gap-1.5"
                title={t("syncWithTheme")}
              >
                <RefreshCw className="h-3 w-3" />
                <span>{t("syncWithTheme")}</span>
              </Button>
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
