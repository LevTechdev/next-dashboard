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
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const THEME_PRESETS = [
  { name: "Indigo Core", hex: "#4f46e5", bg: "bg-indigo-600" },
  { name: "Emerald Growth", hex: "#059669", bg: "bg-emerald-600" },
  { name: "Vivid Rose", hex: "#e11d48", bg: "bg-rose-600" },
  { name: "Warm Amber", hex: "#d97706", bg: "bg-amber-600" },
  { name: "Royal Violet", hex: "#7c3aed", bg: "bg-purple-600" },
  { name: "Ocean Cyan", hex: "#0284c7", bg: "bg-sky-600" },
];

export function WhiteLabelBranding() {
  const t = useTranslations("branding");
  const tcommon = useTranslations("common");

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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
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
                <Globe className="h-4 w-4 text-indigo-500" />
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
                  placeholder="dashboard.yourbrand.com"
                  className="font-mono text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleVerifyDomain}
                disabled={verifying}
                className="shrink-0 gap-1.5 text-xs font-semibold"
              >
                {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("verifyDns")}
              </Button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">CNAME:</span>
                <code className="font-mono text-indigo-600 dark:text-indigo-400">
                  {branding.cnameTarget}
                </code>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyCname}
                className="h-7 px-2 text-xs gap-1"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
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
                placeholder="e.g. Apex Global"
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
                  placeholder="https://yourbrand.com/logo.svg"
                  className="text-xs font-mono"
                />
                <div className="h-9 w-9 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center justify-center bg-gray-50 dark:bg-gray-900 shrink-0">
                  <Building className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Theme Color Accents */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              {t("themeColorAccent")}
            </label>
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
                        ? "border-gray-900 dark:border-white shadow-sm ring-1 ring-gray-900 dark:ring-white"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700",
                    )}
                  >
                    <span className={cn("h-3 w-3 rounded-full shrink-0", p.bg)} />
                    <span>{p.name}</span>
                  </button>
                );
              })}

              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-gray-400">Custom:</span>
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => handleSelectColor(e.target.value)}
                  className="h-8 w-8 rounded border border-gray-200 cursor-pointer bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Invoice & Email Templates Customization */}
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-gray-100">
              <FileText className="h-3.5 w-3.5 text-indigo-500" />
              {t("invoiceNotes")}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                {t("invoiceHeaderNote")}
              </label>
              <Input
                value={branding.invoiceHeaderNote}
                onChange={(e) => setBranding({ ...branding, invoiceHeaderNote: e.target.value })}
                placeholder="Payment terms, bank details, or thank-you note..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                {t("invoiceFooterNote")}
              </label>
              <Input
                value={branding.invoiceFooterNote}
                onChange={(e) => setBranding({ ...branding, invoiceFooterNote: e.target.value })}
                placeholder="Tax ID, legal jurisdiction, and corporate registration..."
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-semibold shadow-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("saveBranding")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
