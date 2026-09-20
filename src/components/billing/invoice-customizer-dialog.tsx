"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import {
  Sliders,
  Printer,
  QrCode,
  Barcode as BarcodeIcon,
  Palette,
  FileCheck2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { generateBarcodeSvg } from "@/lib/barcode";
import { CURRENCIES, convertFromUSD, type SupportedCurrencyCode } from "@/lib/currency";
import { useAppearance } from "@/hooks/use-appearance";

export interface InvoiceTemplateSettings {
  companyName: string;
  taxId: string;
  accentColor: string;
  notes: string;
  showBarcode: boolean;
  showQr: boolean;
  /** Presentation currency for amounts on the printed invoice. */
  currency: SupportedCurrencyCode;
}

const STORAGE_KEY = "levtech-invoice-template-config";

export const DEFAULT_INVOICE_CONFIG: InvoiceTemplateSettings = {
  companyName: "LevTech Solutions Ltd.",
  taxId: "01.847.291.0-014.000",
  accentColor: "#0284c7",
  notes:
    "Official computerized tax invoice. Valid proof of transaction under BI-FAST clearing rules.",
  showBarcode: true,
  showQr: true,
  currency: "USD",
};

export function InvoiceCustomizerDialog({
  open,
  onOpenChange,
  sampleOrderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleOrderId?: string;
}) {
  const t = useTranslations("invoiceCustomizer");
  const { settings: appearance } = useAppearance();

  const [config, setConfig] = useState<InvoiceTemplateSettings>(DEFAULT_INVOICE_CONFIG);
  const [previewBarcodeSvg, setPreviewBarcodeSvg] = useState<string>("");
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState<string>("");

  /** Render USD-base sample amounts in the template's chosen currency. */
  const formatInvoiceMoney = (usdAmount: number) => {
    const cfg = CURRENCIES[config.currency] ?? CURRENCIES.USD;
    const converted = convertFromUSD(usdAmount, config.currency);
    const formatted =
      cfg.decimals === 0
        ? Math.round(converted).toLocaleString("en-US")
        : converted.toLocaleString("en-US", {
            minimumFractionDigits: cfg.decimals,
            maximumFractionDigits: cfg.decimals,
          });
    return `${cfg.symbol}${formatted}`;
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setConfig(JSON.parse(saved));
        } else if (appearance?.customColor) {
          setConfig((prev) => ({ ...prev, accentColor: appearance.customColor! }));
        }
      } catch {
        // ignore
      }
    }
  }, [appearance?.customColor]);

  // Generate Barcode SVG Preview
  useEffect(() => {
    if (config.showBarcode) {
      try {
        const svg = generateBarcodeSvg("ORD-2026-8942", {
          height: 36,
          moduleWidth: 1.4,
          color: "#000000",
          showText: true,
          fontSize: 10,
        });
        setPreviewBarcodeSvg(svg);
      } catch {
        setPreviewBarcodeSvg("");
      }
    } else {
      setPreviewBarcodeSvg("");
    }
  }, [config.showBarcode]);

  // Generate QR Code Data URL Preview with Level H error correction
  useEffect(() => {
    if (config.showQr) {
      QRCode.toDataURL("https://levtech.dev/en/orders/ORD-2026-8942", {
        width: 80,
        margin: 1,
        errorCorrectionLevel: "H",
        color: {
          dark: "#09090b",
          light: "#ffffff",
        },
      })
        .then(setPreviewQrDataUrl)
        .catch(() => setPreviewQrDataUrl(""));
    } else {
      setPreviewQrDataUrl("");
    }
  }, [config.showQr]);

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
    toast.success(t("savedToast"));
    onOpenChange(false);
  };

  const handleOpenPreview = () => {
    const params = new URLSearchParams({
      companyName: config.companyName,
      taxId: config.taxId,
      accent: config.accentColor,
      notes: config.notes,
      barcode: config.showBarcode ? "true" : "false",
      qr: config.showQr ? "true" : "false",
      currency: config.currency,
      preview: "true",
    });
    const orderId = sampleOrderId || "sample-order-id";
    window.open(`/api/orders/${orderId}/invoice?${params.toString()}`, "_blank");
  };

  // Sync with appearance theme color
  const applyAppearanceColor = () => {
    const activeColor =
      appearance?.customColor ||
      (appearance?.accent === "green"
        ? "#10b981"
        : appearance?.accent === "rose"
          ? "#f43f5e"
          : appearance?.accent === "amber"
            ? "#f59e0b"
            : "#0284c7");
    setConfig((prev) => ({ ...prev, accentColor: activeColor }));
    toast.success(t("appearanceSynced"));
  };

  const presetColors = ["#0284c7", "#10b981", "#f43f5e", "#f59e0b", "#8b5cf6", "#0f172a"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sliders size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">{t("dialogTitle")}</DialogTitle>
              <DialogDescription>{t("dialogDesc")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-3">
          {/* Settings Column */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-foreground">{t("companyLabel")}</Label>
              <Input
                value={config.companyName}
                onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                placeholder="LevTech Solutions Ltd."
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">{t("taxIdLabel")}</Label>
              <Input
                value={config.taxId}
                onChange={(e) => setConfig({ ...config, taxId: e.target.value })}
                placeholder="01.847.291.0-014.000"
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  {t("brandColorLabel")}
                </Label>
                <button
                  type="button"
                  onClick={applyAppearanceColor}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Palette className="h-3 w-3" />
                  {t("useAppearanceColor")}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setConfig({ ...config, accentColor: color })}
                    className={`h-7 w-7 rounded-full transition-transform border-2 cursor-pointer ${
                      config.accentColor.toLowerCase() === color.toLowerCase()
                        ? "scale-110 border-foreground ring-2 ring-primary"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
                <Input
                  type="text"
                  value={config.accentColor}
                  onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                  className="w-24 h-7 text-xs font-mono ml-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">{t("notesLabel")}</Label>
              <textarea
                value={config.notes}
                onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                rows={3}
                className="w-full mt-1 text-xs rounded-lg border border-border bg-background p-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground"
                placeholder={t("notesPlaceholder")}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">{t("currencyLabel")}</Label>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {(Object.keys(CURRENCIES) as SupportedCurrencyCode[]).map((code) => {
                  const cfg = CURRENCIES[code];
                  const selected = config.currency === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, currency: code }))}
                      className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                        selected
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                      title={cfg.name}
                    >
                      <span>{cfg.flag}</span>
                      {code}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{t("currencyHint")}</p>
            </div>

            <div className="pt-2 border-t border-border space-y-2">
              <Label className="text-xs font-semibold text-foreground">
                {t("securityBadgesLabel")}
              </Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={config.showBarcode}
                    onChange={(e) => setConfig({ ...config, showBarcode: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <BarcodeIcon className="h-4 w-4 text-muted-foreground" />
                  {t("showBarcodeLabel")}
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={config.showQr}
                    onChange={(e) => setConfig({ ...config, showQr: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <QrCode className="h-4 w-4 text-muted-foreground" />
                  {t("showQrLabel")}
                </label>
              </div>
            </div>
          </div>

          {/* Live Mini Preview */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <span className="text-sm font-extrabold tracking-tight">
                    {config.companyName.split(" ")[0] || "LevTech"}{" "}
                    <span style={{ color: config.accentColor }}>
                      {config.companyName.split(" ").slice(1).join(" ") || "Unified"}
                    </span>
                  </span>
                  <p className="text-[10px] text-muted-foreground">Tax ID: {config.taxId}</p>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                  {t("samplePreviewBadge")}
                </Badge>
              </div>

              {/* Badges preview container: Barcode & QR Verification */}
              {(config.showBarcode || config.showQr) && (
                <div className="my-3 p-3 bg-muted/40 rounded-lg border border-border flex items-center justify-between gap-3 shadow-inner">
                  {config.showBarcode && previewBarcodeSvg && (
                    <div className="bg-white p-2.5 rounded-md border border-zinc-200 shadow-2xs max-w-[170px] overflow-hidden flex items-center justify-center">
                      <div
                        dangerouslySetInnerHTML={{ __html: previewBarcodeSvg }}
                        className="w-full flex justify-center text-zinc-950"
                      />
                    </div>
                  )}
                  {config.showQr && previewQrDataUrl && (
                    <div className="flex flex-col items-center shrink-0 border-l border-border pl-3">
                      <div className="bg-white p-1 rounded-md border border-zinc-200 shadow-2xs">
                        <img
                          src={previewQrDataUrl}
                          alt="QR Verification"
                          className="w-12 h-12 object-contain rounded"
                        />
                      </div>
                      <span className="text-[7px] font-mono text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                        {t("qrVerifiedLabel")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 text-[11px] text-muted-foreground mt-3">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Standard Commerce Package</span>
                  <span className="font-semibold text-foreground">{formatInvoiceMoney(120)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>VAT / Tax (11%)</span>
                  <span className="font-semibold text-foreground">{formatInvoiceMoney(13.2)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-foreground">
                  <span>Total Due / Paid</span>
                  <span style={{ color: config.accentColor }}>{formatInvoiceMoney(133.2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground italic line-clamp-2">
                {config.notes}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={handleOpenPreview} className="gap-1.5">
            <Printer className="h-4 w-4" />
            {t("livePreviewBtn")}
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t("cancelBtn")}
            </Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <FileCheck2 className="h-4 w-4" />
              {t("saveBtn")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
